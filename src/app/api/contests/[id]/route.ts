import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { awardContestPrize } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

async function finishContest(id: string) {
  const c = await prisma.contest.findUnique({
    where: { id },
    include: {
      problems: { orderBy: { order: 'asc' } },
      contributors: { select: { userId: true } },
    },
  })
  if (!c || c.prizesAwarded) return

  // 출제자 + 주최자 userId 집합 (상금 제외 대상)
  const excludedUserIds = new Set([c.organizerId, ...c.contributors.map((ct) => ct.userId)])

  // 종료 처리
  await prisma.contest.update({ where: { id }, data: { status: 'ENDED', prizesAwarded: true } })

  // ── 대회 문제 → 일반 문제 탭으로 이전 ──
  // 이미 이전된 문제(같은 contestId)가 없는 경우에만 생성
  const alreadyMoved = await prisma.problem.count({ where: { contestId: id } })
  if (alreadyMoved === 0 && c.problems.length > 0) {
    for (const cp of c.problems) {
      const agg = await prisma.problem.aggregate({ _max: { problemNumber: true } })
      const nextNum = (agg._max.problemNumber ?? 0) + 1
      await prisma.problem.create({
        data: {
          problemNumber: nextNum,
          title: cp.title,
          content: cp.content,
          answer: cp.answer,
          extraAnswers: cp.extraAnswers,   // 다중 정답 그대로
          subAnswers: cp.subAnswers,       // 다중 필수 답변 그대로
          imageUrls: cp.imageUrls,
          approvedPts: cp.points,          // 대회 배점 → 풀기 포인트
          status: 'APPROVED',              // 검토된 문제이므로 바로 승인
          authorId: c.organizerId,
          contestId: id,                   // 출처 대회 연결
        },
      })
    }
  }

  // ── 상금 지급 ──
  if (!c.prize1 && !c.prize2 && !c.prize3) return
  // 출제자/주최자 제외하고 점수 내림차순, 동점 시 마지막 정답 제출 시각 빠른 순으로 상위 3명 선발
  const allParticipants = await prisma.contestParticipant.findMany({
    where: { contestId: id },
  })
  const eligible = allParticipants.filter((p) => !excludedUserIds.has(p.userId))

  // Compute lastCorrectAt per eligible user
  const correctSubs = await prisma.contestSubmission.findMany({
    where: {
      problem: { contestId: id },
      correct: true,
      userId: { in: eligible.map((p) => p.userId) },
    },
    select: { userId: true, createdAt: true },
  })
  const lastCorrectAt: Record<string, Date> = {}
  for (const s of correctSubs) {
    const t = new Date(s.createdAt)
    if (!lastCorrectAt[s.userId] || t > lastCorrectAt[s.userId]) {
      lastCorrectAt[s.userId] = t
    }
  }
  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aLast = lastCorrectAt[a.userId]?.getTime() ?? Infinity
    const bLast = lastCorrectAt[b.userId]?.getTime() ?? Infinity
    return aLast - bLast
  })
  const top = eligible.slice(0, 3)
  const prizes = [c.prize1, c.prize2, c.prize3]
  for (let i = 0; i < top.length; i++) {
    const amount = prizes[i]
    if (amount && amount > 0) await awardContestPrize(top[i].userId, amount, i + 1)
  }
}

async function autoEndIfExpired(id: string) {
  const c = await prisma.contest.findUnique({ where: { id } })
  if (!c || c.status !== 'ONGOING' || !c.startTime) return
  const elapsed = Date.now() - new Date(c.startTime).getTime()
  if (elapsed >= c.durationMin * 60 * 1000) {
    await finishContest(id)
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await autoEndIfExpired(params.id)
  const session = await getAuth()

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: {
      organizer: { select: { id: true, name: true, image: true, points: true } },
      problems: { orderBy: { order: 'asc' } },
      contributors: { include: { user: { select: { id: true, name: true, image: true, points: true } } } },
      _count: { select: { participants: true } },
    },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session?.user?.id === contest.organizerId
  const isAdmin = session?.user?.role === 'ADMIN'
  const isContributor = session?.user
    ? contest.contributors.some((c) => c.userId === session!.user!.id)
    : false

  // DRAFT/PENDING: organizer/admin/contributor only
  if (['DRAFT', 'PENDING'].includes(contest.status) && !isOrganizer && !isAdmin && !isContributor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Hide answers from non-organizers (contributors can see answers for review)
  const canSeeAnswers = isOrganizer || isAdmin || isContributor
  const parseProblems = (ps: typeof contest.problems) =>
    ps.map((p) => ({
      ...p,
      imageUrls: (() => { try { return JSON.parse(p.imageUrls as string) } catch { return [] } })(),
      extraAnswers: (() => { try { return JSON.parse(p.extraAnswers as string) } catch { return [] } })(),
      subAnswers: (() => { try { return JSON.parse(p.subAnswers as string) } catch { return [] } })(),
    }))
  const problems = canSeeAnswers
    ? parseProblems(contest.problems)
    : parseProblems(contest.problems).map(({ answer: _a, ...p }) => p)

  // My participation & submissions
  let myParticipant = null
  let mySubmissions: Record<string, boolean> = {}
  if (session?.user) {
    myParticipant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
    })
    if (myParticipant) {
      const subs = await prisma.contestSubmission.findMany({
        where: { userId: session.user.id, problem: { contestId: params.id } },
      })
      mySubmissions = Object.fromEntries(subs.map((s) => [s.problemId, s.correct]))
    }
  }

  return NextResponse.json({ ...contest, problems, myParticipant, mySubmissions })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOrganizer && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await req.json()

  if (data.status === 'ENDED') {
    await finishContest(params.id)
    const updated = await prisma.contest.findUnique({ where: { id: params.id } })
    return NextResponse.json(updated)
  }

  // Handle contributors update: support both {userId, role} (direct) and {query, role} (resolve by name/email)
  if (Array.isArray(data.contributors)) {
    const resolved: { userId: string; role: string }[] = []
    for (const c of data.contributors) {
      if (c.userId) {
        resolved.push({ userId: c.userId, role: c.role })
      } else if (c.query) {
        const u = await prisma.user.findFirst({
          where: { OR: [{ email: c.query }, { name: c.query }] },
          select: { id: true },
        })
        if (u) resolved.push({ userId: u.id, role: c.role })
      }
    }
    await prisma.contestContributor.deleteMany({ where: { contestId: params.id } })
    if (resolved.length > 0) {
      await prisma.contestContributor.createMany({
        data: resolved.map((r) => ({ contestId: params.id, ...r })),
      })
    }
  }

  const updated = await prisma.contest.findUnique({
    where: { id: params.id },
    include: {
      organizer: { select: { id: true, name: true, image: true, points: true } },
      contributors: { include: { user: { select: { id: true, name: true, image: true, points: true } } } },
      _count: { select: { participants: true } },
    },
  })

  if (data.title || data.description !== undefined || data.rules !== undefined || data.prize1 !== undefined || data.prize2 !== undefined || data.prize3 !== undefined) {
    await prisma.contest.update({
      where: { id: params.id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.rules !== undefined ? { rules: data.rules } : {}),
        ...(data.prize1 !== undefined ? { prize1: data.prize1 ? Number(data.prize1) : null } : {}),
        ...(data.prize2 !== undefined ? { prize2: data.prize2 ? Number(data.prize2) : null } : {}),
        ...(data.prize3 !== undefined ? { prize3: data.prize3 ? Number(data.prize3) : null } : {}),
      },
    })
  }

  const finalContest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: {
      organizer: { select: { id: true, name: true, image: true, points: true } },
      contributors: { include: { user: { select: { id: true, name: true, image: true, points: true } } } },
      _count: { select: { participants: true } },
    },
  })
  return NextResponse.json(finalContest)
}

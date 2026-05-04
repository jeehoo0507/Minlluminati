import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DUEL_TIERS: Record<string, { min: number; max: number }> = {
  '새싹':   { min: 1,   max: 19    },
  '브론즈':  { min: 20,  max: 49    },
  '실버':   { min: 50,  max: 99    },
  '골드':   { min: 100, max: 199   },
  '플래티넘': { min: 200, max: 499   },
  '다이아':  { min: 500, max: 99999 },
}

async function checkAndFinalizeDuel(duelId: string) {
  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
    include: { submissions: true },
  })
  if (!duel || duel.status !== 'ACTIVE' || duel.winnerDeclared) return duel

  const now = new Date()
  const endTime = duel.startedAt
    ? new Date(duel.startedAt.getTime() + duel.timeLimit * 1000)
    : null
  const timeExpired = endTime ? now >= endTime : false

  const problemIds: string[] = JSON.parse(duel.problems)
  const challengerCorrect = duel.submissions.filter(
    (s) => s.userId === duel.challengerId && s.correct,
  ).length
  const challengedCorrect = duel.submissions.filter(
    (s) => s.userId === duel.challengedId && s.correct,
  ).length

  const challengerDone = problemIds.every((pid) =>
    duel.submissions.some((s) => s.userId === duel.challengerId && s.problemId === pid && s.correct),
  )
  const challengedDone = problemIds.every((pid) =>
    duel.submissions.some((s) => s.userId === duel.challengedId && s.problemId === pid && s.correct),
  )

  if (!timeExpired && !(challengerDone && challengedDone)) return duel

  // Finalize
  let winnerId: string | null = null
  if (challengerCorrect > challengedCorrect) winnerId = duel.challengerId
  else if (challengedCorrect > challengerCorrect) winnerId = duel.challengedId
  // else draw

  await prisma.duel.update({
    where: { id: duelId },
    data: {
      status: 'FINISHED',
      endedAt: now,
      challengerScore: challengerCorrect,
      challengedScore: challengedCorrect,
      winnerId,
      winnerDeclared: true,
    },
  })

  const notifFor = (myId: string) => ({
    title: !winnerId ? '대결 무승부' : winnerId === myId ? '대결 승리! 🎉' : '대결 패배',
    content: !winnerId
      ? `대결이 무승부로 종료되었습니다.`
      : winnerId === myId
        ? `대결에서 승리했습니다! 🎉`
        : `대결에서 패배했습니다.`,
  })

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: duel.challengerId,
        type: 'DUEL_RESULT',
        ...notifFor(duel.challengerId),
        link: `/problems/randb/${duelId}`,
      },
    }),
    prisma.notification.create({
      data: {
        userId: duel.challengedId,
        type: 'DUEL_RESULT',
        ...notifFor(duel.challengedId),
        link: `/problems/randb/${duelId}`,
      },
    }),
  ])

  return await prisma.duel.findUnique({ where: { id: duelId }, include: { submissions: true } })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const duel = await checkAndFinalizeDuel(params.id)
  if (!duel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = session.user.id
  if (duel.challengerId !== userId && duel.challengedId !== userId && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get problem details if ACTIVE or FINISHED
  let problems: unknown[] = []
  if (duel.status === 'ACTIVE' || duel.status === 'FINISHED') {
    const problemIds: string[] = JSON.parse(duel.problems)
    const probs = await prisma.problem.findMany({
      where: { id: { in: problemIds } },
      select: {
        id: true,
        title: true,
        problemNumber: true,
        subject: true,
        approvedPts: true,
        content: true,
        imageUrls: true,
      },
    })
    problems = problemIds.map((pid) => probs.find((p) => p.id === pid)).filter(Boolean)
  }

  const [challenger, challenged] = await Promise.all([
    prisma.user.findUnique({
      where: { id: duel.challengerId },
      select: { id: true, name: true, image: true, points: true },
    }),
    prisma.user.findUnique({
      where: { id: duel.challengedId },
      select: { id: true, name: true, image: true, points: true },
    }),
  ])

  return NextResponse.json({ ...duel, problems, challenger, challenged })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const duel = await prisma.duel.findUnique({ where: { id: params.id } })
  if (!duel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = session.user.id
  const { action } = await req.json()

  // ── Accept ──
  if (action === 'accept') {
    if (duel.challengedId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (duel.status !== 'PENDING')
      return NextResponse.json({ error: '수락할 수 없는 대결입니다' }, { status: 400 })

    const difficulties: string[] = JSON.parse(duel.difficulties)
    const excludedSubjects: string[] = JSON.parse(duel.excludedSubjects)

    const tierRanges = difficulties.map((d) => DUEL_TIERS[d]).filter(Boolean)
    if (!tierRanges.length)
      return NextResponse.json({ error: '유효한 난이도가 없습니다' }, { status: 400 })

    const orConditions = tierRanges.map((r) => ({
      approvedPts: { gte: r.min, lte: r.max },
    }))

    const eligible = await prisma.problem.findMany({
      where: {
        status: 'APPROVED',
        isEssay: false,
        NOT: { answer: { in: ['[multi-part]', '[essay]'] } },
        OR: orConditions,
        ...(excludedSubjects.length > 0 ? { NOT: { subject: { in: excludedSubjects } } } : {}),
      },
      select: { id: true },
    })

    if (eligible.length < duel.problemCount) {
      return NextResponse.json(
        {
          error: `조건에 맞는 문제가 부족합니다 (현재 ${eligible.length}개, 필요 ${duel.problemCount}개). 난이도나 문제 수를 조정해주세요`,
        },
        { status: 400 },
      )
    }

    const shuffled = [...eligible].sort(() => Math.random() - 0.5).slice(0, duel.problemCount)
    const problemIds = shuffled.map((p) => p.id)

    await prisma.duel.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
        problems: JSON.stringify(problemIds),
        startedAt: new Date(),
      },
    })

    await prisma.notification.create({
      data: {
        userId: duel.challengerId,
        type: 'DUEL_ACCEPTED',
        title: '대결이 수락되었습니다! ⚔️',
        content: `${session.user.name}님이 대결을 수락했습니다. 지금 시작하세요!`,
        link: `/problems/randb/${params.id}`,
      },
    })

    return NextResponse.json({ ok: true, duelId: params.id })
  }

  // ── Decline ──
  if (action === 'decline') {
    if (duel.challengedId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (duel.status !== 'PENDING')
      return NextResponse.json({ error: '처리할 수 없는 대결입니다' }, { status: 400 })

    await prisma.duel.update({ where: { id: params.id }, data: { status: 'DECLINED' } })

    await prisma.notification.create({
      data: {
        userId: duel.challengerId,
        type: 'DUEL_DECLINED',
        title: '대결 거절',
        content: `${session.user.name}님이 대결을 거절했습니다.`,
        link: '/problems/randb',
      },
    })

    return NextResponse.json({ ok: true })
  }

  // ── Cancel (challenger cancels pending) ──
  if (action === 'cancel') {
    if (duel.challengerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (duel.status !== 'PENDING')
      return NextResponse.json({ error: '취소할 수 없는 대결입니다' }, { status: 400 })

    await prisma.duel.update({ where: { id: params.id }, data: { status: 'DECLINED' } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

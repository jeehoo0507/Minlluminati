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

async function finalizeDuel(duelId: string, winnerId: string | null, challengerScore: number, challengedScore: number) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } })
  if (!duel || duel.winnerDeclared) return

  await prisma.duel.update({
    where: { id: duelId },
    data: {
      status: 'FINISHED',
      endedAt: new Date(),
      challengerScore,
      challengedScore,
      winnerId,
      winnerDeclared: true,
    },
  })

  const notifFor = (myId: string) => ({
    title: !winnerId ? '대결 무승부' : winnerId === myId ? '대결 승리! 🎉' : '대결 패배',
    content: !winnerId
      ? '대결이 무승부로 종료되었습니다.'
      : winnerId === myId
        ? `대결에서 승리했습니다! 🎉`
        : '대결에서 패배했습니다.',
  })

  await Promise.all([
    prisma.notification.create({
      data: { userId: duel.challengerId, type: 'DUEL_RESULT', ...notifFor(duel.challengerId), link: `/problems/randb/${duelId}` },
    }),
    prisma.notification.create({
      data: { userId: duel.challengedId, type: 'DUEL_RESULT', ...notifFor(duel.challengedId), link: `/problems/randb/${duelId}` },
    }),
  ])
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
  const challengerCorrect = duel.submissions.filter(s => s.userId === duel.challengerId && s.correct).length
  const challengedCorrect = duel.submissions.filter(s => s.userId === duel.challengedId && s.correct).length

  const challengerDone = problemIds.every(pid =>
    duel.submissions.some(s => s.userId === duel.challengerId && s.problemId === pid && s.correct),
  )
  const challengedDone = problemIds.every(pid =>
    duel.submissions.some(s => s.userId === duel.challengedId && s.problemId === pid && s.correct),
  )

  // 먼저 모두 풀면 즉시 종료
  if (challengerDone) {
    await finalizeDuel(duelId, duel.challengerId, challengerCorrect, challengedCorrect)
    return await prisma.duel.findUnique({ where: { id: duelId }, include: { submissions: true } })
  }
  if (challengedDone) {
    await finalizeDuel(duelId, duel.challengedId, challengerCorrect, challengedCorrect)
    return await prisma.duel.findUnique({ where: { id: duelId }, include: { submissions: true } })
  }

  // 시간 초과
  if (timeExpired) {
    const winnerId =
      challengerCorrect > challengedCorrect ? duel.challengerId :
      challengedCorrect > challengerCorrect ? duel.challengedId : null
    await finalizeDuel(duelId, winnerId, challengerCorrect, challengedCorrect)
    return await prisma.duel.findUnique({ where: { id: duelId }, include: { submissions: true } })
  }

  return duel
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
    problems = problemIds.map(pid => probs.find(p => p.id === pid)).filter(Boolean)
  }

  const [challenger, challenged] = await Promise.all([
    prisma.user.findUnique({ where: { id: duel.challengerId }, select: { id: true, name: true, image: true, points: true } }),
    prisma.user.findUnique({ where: { id: duel.challengedId }, select: { id: true, name: true, image: true, points: true } }),
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
    if (duel.status !== 'PENDING') return NextResponse.json({ error: '수락할 수 없는 대결입니다' }, { status: 400 })

    const difficulties: string[] = JSON.parse(duel.difficulties)
    const excludedSubjects: string[] = JSON.parse(duel.excludedSubjects)
    const tierRanges = difficulties.map(d => DUEL_TIERS[d]).filter(Boolean)
    if (!tierRanges.length) return NextResponse.json({ error: '유효한 난이도가 없습니다' }, { status: 400 })

    // 제외할 문제 ID 목록 구성
    const excludedProblemIds: string[] = []
    if (!duel.allowSolved) {
      const [solvedChallenger, solvedChallenged] = await Promise.all([
        prisma.problemSubmission.findMany({ where: { userId: duel.challengerId, correct: true }, select: { problemId: true } }),
        prisma.problemSubmission.findMany({ where: { userId: duel.challengedId, correct: true }, select: { problemId: true } }),
      ])
      const solvedSet = new Set([
        ...solvedChallenger.map(s => s.problemId),
        ...solvedChallenged.map(s => s.problemId),
      ])
      excludedProblemIds.push(...Array.from(solvedSet))
    }

    const eligible = await prisma.problem.findMany({
      where: {
        status: 'APPROVED',
        isEssay: false,
        OR: tierRanges.map(r => ({ approvedPts: { gte: r.min, lte: r.max } })),
        NOT: [
          { answer: { in: ['[multi-part]', '[essay]'] } },
          ...(excludedSubjects.length > 0 ? [{ subject: { in: excludedSubjects } }] : []),
          ...(excludedProblemIds.length > 0 ? [{ id: { in: excludedProblemIds } }] : []),
        ],
      },
      select: { id: true },
    })

    if (eligible.length < duel.problemCount) {
      const reason = !duel.allowSolved ? '(이미 푼 문제 제외 후 ' : '('
      return NextResponse.json(
        { error: `조건에 맞는 문제가 부족합니다 ${reason}현재 ${eligible.length}개, 필요 ${duel.problemCount}개). 난이도나 문제 수를 조정해주세요` },
        { status: 400 },
      )
    }

    const shuffled = [...eligible].sort(() => Math.random() - 0.5).slice(0, duel.problemCount)

    await prisma.duel.update({
      where: { id: params.id },
      data: { status: 'ACTIVE', problems: JSON.stringify(shuffled.map(p => p.id)), startedAt: new Date() },
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
    if (duel.status !== 'PENDING') return NextResponse.json({ error: '처리할 수 없는 대결입니다' }, { status: 400 })

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

  // ── Cancel ──
  if (action === 'cancel') {
    if (duel.challengerId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (duel.status !== 'PENDING') return NextResponse.json({ error: '취소할 수 없는 대결입니다' }, { status: 400 })
    await prisma.duel.update({ where: { id: params.id }, data: { status: 'DECLINED' } })
    return NextResponse.json({ ok: true })
  }

  // ── Forfeit (나가면 실격패) ──
  if (action === 'forfeit') {
    if (duel.challengerId !== userId && duel.challengedId !== userId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (duel.status !== 'ACTIVE' || duel.winnerDeclared)
      return NextResponse.json({ ok: true }) // 이미 종료됨

    const winnerId = userId === duel.challengerId ? duel.challengedId : duel.challengerId
    const subs = await prisma.duelSubmission.findMany({ where: { duelId: params.id } })
    const cScore = subs.filter(s => s.userId === duel.challengerId && s.correct).length
    const dScore = subs.filter(s => s.userId === duel.challengedId && s.correct).length

    await finalizeDuel(params.id, winnerId, cScore, dScore)

    // 실격 알림
    await prisma.notification.create({
      data: {
        userId: winnerId,
        type: 'DUEL_RESULT',
        title: '대결 승리! 🎉 (상대 실격)',
        content: '상대방이 대결 도중 이탈하여 승리했습니다.',
        link: `/problems/randb/${params.id}`,
      },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

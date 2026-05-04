import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { problemId, answer } = await req.json()
  if (!problemId || !answer?.trim())
    return NextResponse.json({ error: '답안을 입력하세요' }, { status: 400 })

  const duel = await prisma.duel.findUnique({
    where: { id: params.id },
    include: { submissions: true },
  })
  if (!duel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = session.user.id
  if (duel.challengerId !== userId && duel.challengedId !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (duel.status !== 'ACTIVE')
    return NextResponse.json({ error: '진행 중인 대결이 아닙니다' }, { status: 400 })

  // Check time limit
  if (duel.startedAt) {
    const endTime = new Date(duel.startedAt.getTime() + duel.timeLimit * 1000)
    if (new Date() >= endTime)
      return NextResponse.json({ error: '시간이 초과되었습니다' }, { status: 400 })
  }

  // Already solved this problem correctly?
  const existing = duel.submissions.find(
    (s) => s.userId === userId && s.problemId === problemId && s.correct,
  )
  if (existing) return NextResponse.json({ correct: true, alreadySolved: true })

  // Verify problem belongs to this duel
  const problemIds: string[] = JSON.parse(duel.problems)
  if (!problemIds.includes(problemId))
    return NextResponse.json({ error: '이 문제는 현재 대결에 포함되지 않습니다' }, { status: 400 })

  // Get problem answer
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { answer: true, extraAnswers: true },
  })
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 })

  const submitted = normalize(answer)
  let extraArr: string[] = []
  try { extraArr = JSON.parse(problem.extraAnswers ?? '[]') } catch { /* ignore */ }
  const allAnswers = [problem.answer, ...extraArr].map(normalize)
  const correct = allAnswers.some((a) => a === submitted)

  // Upsert submission (allow re-try until correct)
  await prisma.duelSubmission.upsert({
    where: { duelId_userId_problemId: { duelId: params.id, userId, problemId } },
    create: { duelId: params.id, userId, problemId, correct },
    update: { correct },
  })

  // Check if both players finished all problems → finalize
  if (correct) {
    const allSubs = await prisma.duelSubmission.findMany({
      where: { duelId: params.id },
    })
    const challengerDone = problemIds.every((pid) =>
      allSubs.some((s) => s.userId === duel.challengerId && s.problemId === pid && s.correct),
    )
    const challengedDone = problemIds.every((pid) =>
      allSubs.some((s) => s.userId === duel.challengedId && s.problemId === pid && s.correct),
    )

    if (challengerDone && challengedDone) {
      const challengerScore = allSubs.filter(
        (s) => s.userId === duel.challengerId && s.correct,
      ).length
      const challengedScore = allSubs.filter(
        (s) => s.userId === duel.challengedId && s.correct,
      ).length
      const winnerId =
        challengerScore > challengedScore
          ? duel.challengerId
          : challengedScore > challengerScore
            ? duel.challengedId
            : null

      if (!duel.winnerDeclared) {
        await prisma.duel.update({
          where: { id: params.id },
          data: {
            status: 'FINISHED',
            endedAt: new Date(),
            challengerScore,
            challengedScore,
            winnerId,
            winnerDeclared: true,
          },
        })
      }
      return NextResponse.json({ correct, finished: true, winnerId })
    }
  }

  return NextResponse.json({ correct })
}

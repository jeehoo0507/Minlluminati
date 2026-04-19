import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest || contest.status !== 'ONGOING') {
    return NextResponse.json({ error: '진행 중인 대회가 아닙니다' }, { status: 400 })
  }

  // Check time
  if (contest.startTime) {
    const elapsed = Date.now() - new Date(contest.startTime).getTime()
    if (elapsed >= contest.durationMin * 60 * 1000) {
      await prisma.contest.update({ where: { id: params.id }, data: { status: 'ENDED' } })
      return NextResponse.json({ error: '대회가 종료되었습니다' }, { status: 400 })
    }
  }

  const participant = await prisma.contestParticipant.findUnique({
    where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
  })
  if (!participant) return NextResponse.json({ error: '먼저 대회에 참가하세요' }, { status: 400 })

  const { problemId, answer } = await req.json()
  if (!problemId || !answer) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })

  const problem = await prisma.contestProblem.findUnique({ where: { id: problemId } })
  if (!problem || problem.contestId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if already correctly solved or retry not allowed
  const existing = await prisma.contestSubmission.findUnique({
    where: { problemId_userId: { problemId, userId: session.user.id } },
  })
  if (existing?.correct) return NextResponse.json({ correct: true, alreadySolved: true })
  if (!problem.allowRetry && existing) {
    return NextResponse.json({ error: '이 문제는 재시도가 불가능합니다', noRetry: true }, { status: 400 })
  }

  const normalizedAnswer = answer.trim().toLowerCase().replace(/\s/g, '')
  const correctAnswer = problem.answer.trim().toLowerCase().replace(/\s/g, '')
  let extraAnswers: string[] = []
  try { extraAnswers = JSON.parse(problem.extraAnswers) } catch {}
  const allAnswers = [correctAnswer, ...extraAnswers.map((a) => a.trim().toLowerCase().replace(/\s/g, ''))]
  const correct = allAnswers.some((a) => a === normalizedAnswer)

  await prisma.contestSubmission.upsert({
    where: { problemId_userId: { problemId, userId: session.user.id } },
    create: { problemId, userId: session.user.id, answer, correct },
    update: { answer, correct },
  })

  if (correct) {
    await prisma.contestParticipant.update({
      where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
      data: { score: { increment: problem.points } },
    })
  }

  return NextResponse.json({ correct })
}

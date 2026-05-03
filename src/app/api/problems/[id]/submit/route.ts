import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const submission = await prisma.problemSubmission.findUnique({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
  })

  return NextResponse.json({ submission })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (problem.status !== 'APPROVED') {
    return NextResponse.json({ error: '승인된 문제가 아닙니다' }, { status: 400 })
  }

  const { answer, parts } = await req.json()

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')

  // Parse subAnswers
  const subAnswerDefs: { label: string; answer: string; extra?: string[] }[] = (() => {
    try { return JSON.parse(problem.subAnswers ?? '[]') } catch { return [] }
  })()

  let correct: boolean
  let storedAnswer: string

  if (subAnswerDefs.length > 0) {
    // Multi-part mode
    if (!Array.isArray(parts) || parts.length !== subAnswerDefs.length) {
      return NextResponse.json({ error: '답변 개수가 맞지 않습니다' }, { status: 400 })
    }
    correct = subAnswerDefs.every((def, i) => {
      const submitted = normalize(parts[i] ?? '')
      const allValid = [def.answer, ...(def.extra ?? [])].map(normalize)
      return allValid.some((a) => a === submitted)
    })
    storedAnswer = JSON.stringify(parts)
  } else {
    // Single mode
    if (!answer?.trim()) return NextResponse.json({ error: '답을 입력해주세요' }, { status: 400 })
    const extraAnswers: string[] = (() => { try { return JSON.parse(problem.extraAnswers ?? '[]') } catch { return [] } })()
    const allAnswers = [problem.answer, ...extraAnswers].map(normalize)
    correct = allAnswers.some((a) => a === normalize(answer))
    storedAnswer = answer.trim()
  }

  // Check if already correctly submitted (to avoid double point award)
  const existing = await prisma.problemSubmission.findUnique({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
  })
  const wasAlreadyCorrect = existing?.correct ?? false

  // Upsert submission
  await prisma.problemSubmission.upsert({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
    create: { problemId: params.id, userId: session.user.id, answer: storedAnswer, correct },
    update: { answer: storedAnswer, correct },
  })

  // Award points only on first correct submission (authors cannot earn from their own problems)
  let pointsAwarded = 0
  const isSelfSolve = problem.authorId === session.user.id
  if (correct && !wasAlreadyCorrect && problem.approvedPts && problem.approvedPts > 0 && !isSelfSolve) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { points: { increment: problem.approvedPts } },
      }),
      prisma.pointHistory.create({
        data: {
          userId: session.user.id,
          delta: problem.approvedPts,
          reason: '문제 풀기',
          subject: problem.subject ?? undefined,
        },
      }),
    ])
    pointsAwarded = problem.approvedPts
  }

  // 라이벌 알림: 처음으로 정답 맞힌 경우 → 이 유저를 라이벌로 등록한 모든 유저에게 알림
  if (correct && !wasAlreadyCorrect) {
    const solver = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
    const rivalOf = await prisma.rival.findMany({
      where: { rivalId: session.user.id },
      select: { userId: true },
    })
    if (rivalOf.length > 0) {
      await prisma.notification.createMany({
        data: rivalOf.map((r) => ({
          userId: r.userId,
          type: 'RIVAL_SOLVED',
          title: '라이벌이 문제를 풀었습니다',
          content: `${solver?.name ?? '라이벌'}이(가) #${problem.problemNumber} "${problem.title}"을(를) 풀었습니다`,
          link: `/problems/${params.id}`,
        })),
      })
    }
  }

  return NextResponse.json({ correct, pointsAwarded, multiPart: subAnswerDefs.length > 0, isSelfSolve })
}

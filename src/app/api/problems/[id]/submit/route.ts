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

  const { answer } = await req.json()
  if (!answer?.trim()) return NextResponse.json({ error: '답을 입력해주세요' }, { status: 400 })

  const correct = answer.trim().toLowerCase() === problem.answer.trim().toLowerCase()

  // Check if already correctly submitted (to avoid double point award)
  const existing = await prisma.problemSubmission.findUnique({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
  })
  const wasAlreadyCorrect = existing?.correct ?? false

  // Upsert submission
  await prisma.problemSubmission.upsert({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
    create: { problemId: params.id, userId: session.user.id, answer: answer.trim(), correct },
    update: { answer: answer.trim(), correct },
  })

  // Award points only on first correct submission
  let pointsAwarded = 0
  if (correct && !wasAlreadyCorrect && problem.approvedPts && problem.approvedPts > 0) {
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

  return NextResponse.json({ correct, pointsAwarded })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: problem author/admin gets all essay submissions; regular users get their own
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isAdmin = session.user.role === 'ADMIN'
  const isAuthor = session.user.id === problem.authorId

  if (isAdmin || isAuthor) {
    const submissions = await prisma.problemEssaySubmission.findMany({
      where: { problemId: params.id },
      include: { user: { select: { id: true, name: true, image: true, points: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ submissions })
  }

  // Regular user: return their own submission
  const sub = await prisma.problemEssaySubmission.findUnique({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
  })
  return NextResponse.json({ mySubmission: sub ?? null })
}

// POST: user submits essay answer
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem || problem.status !== 'APPROVED' || !problem.isEssay) {
    return NextResponse.json({ error: '서술형 문제가 아니거나 승인되지 않은 문제입니다' }, { status: 400 })
  }
  const { content, imageUrls } = await req.json()
  if (!content?.trim() && (!imageUrls || imageUrls.length === 0)) {
    return NextResponse.json({ error: '답안 내용 또는 이미지를 첨부하세요' }, { status: 400 })
  }
  const submission = await prisma.problemEssaySubmission.upsert({
    where: { problemId_userId: { problemId: params.id, userId: session.user.id } },
    create: {
      problemId: params.id,
      userId: session.user.id,
      content: content?.trim() ?? '',
      imageUrls: JSON.stringify(imageUrls ?? []),
      status: 'PENDING',
    },
    update: {
      content: content?.trim() ?? '',
      imageUrls: JSON.stringify(imageUrls ?? []),
      status: 'PENDING',
    },
  })
  return NextResponse.json(submission)
}

// PATCH: author/admin approves or rejects
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isAdmin = session.user.role === 'ADMIN'
  const isAuthor = session.user.id === problem.authorId
  if (!isAdmin && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { submissionId, status } = await req.json()
  if (!submissionId || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const sub = await prisma.problemEssaySubmission.findUnique({
    where: { id: submissionId },
    include: { user: true },
  })
  if (!sub || sub.problemId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.problemEssaySubmission.update({ where: { id: submissionId }, data: { status } })

  // On approval: create correct submission + solution
  if (status === 'APPROVED' && sub.status !== 'APPROVED') {
    // Upsert a correct ProblemSubmission
    await prisma.problemSubmission.upsert({
      where: { problemId_userId: { problemId: params.id, userId: sub.userId } },
      create: { problemId: params.id, userId: sub.userId, answer: '[essay-approved]', correct: true },
      update: { correct: true, answer: '[essay-approved]' },
    })
    // Award points if problem has approvedPts
    if (problem.approvedPts && problem.approvedPts > 0) {
      await prisma.user.update({ where: { id: sub.userId }, data: { points: { increment: problem.approvedPts } } })
      await prisma.pointHistory.create({
        data: { userId: sub.userId, delta: problem.approvedPts, reason: `서술형 정답 승인: ${problem.title}`, subject: problem.subject ?? undefined },
      })
    }
    // Create solution from essay content
    await prisma.problemSolution.create({
      data: { problemId: params.id, authorId: sub.userId, content: sub.content || '(서술형 답안)', imageUrls: sub.imageUrls },
    })
  }
  // On rejection after approval: revoke
  if (status === 'REJECTED' && sub.status === 'APPROVED') {
    await prisma.problemSubmission.updateMany({
      where: { problemId: params.id, userId: sub.userId, answer: '[essay-approved]' },
      data: { correct: false },
    })
    if (problem.approvedPts && problem.approvedPts > 0) {
      await prisma.user.update({ where: { id: sub.userId }, data: { points: { decrement: problem.approvedPts } } })
      await prisma.pointHistory.create({
        data: { userId: sub.userId, delta: -problem.approvedPts, reason: `서술형 승인 취소: ${problem.title}`, subject: problem.subject ?? undefined },
      })
    }
  }

  return NextResponse.json({ ok: true })
}

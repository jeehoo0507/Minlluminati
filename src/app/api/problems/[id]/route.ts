import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = session?.user?.id

  // Support lookup by problemNumber (numeric string) OR by id
  const isNumber = /^\d+$/.test(params.id)
  const problem = isNumber
    ? await prisma.problem.findFirst({
        where: { problemNumber: parseInt(params.id) },
        include: {
          author: { select: { id: true, name: true, image: true, points: true, role: true } },
          _count: { select: { submissions: true, solutions: true } },
        },
      })
    : await prisma.problem.findUnique({
        where: { id: params.id },
        include: {
          author: { select: { id: true, name: true, image: true, points: true, role: true } },
          _count: { select: { submissions: true, solutions: true } },
        },
      })

  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Non-admins can only see approved problems or their own
  if (problem.status !== 'APPROVED' && problem.authorId !== userId && session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get user's submission status
  let userSubmission = null
  if (userId) {
    userSubmission = await prisma.problemSubmission.findUnique({
      where: { problemId_userId: { problemId: params.id, userId } },
    })
  }

  // Get correct count
  const correctCount = await prisma.problemSubmission.count({
    where: { problemId: params.id, correct: true },
  })

  return NextResponse.json({
    ...problem,
    userSubmission,
    correctCount,
    solveRate: problem._count.submissions > 0 ? Math.round((correctCount / problem._count.submissions) * 100) : 0,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status, approvedPts, title, content, answer, subject } = await req.json()

  const updated = await prisma.problem.update({
    where: { id: params.id },
    data: {
      ...(status ? { status } : {}),
      ...(approvedPts !== undefined ? { approvedPts } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(subject !== undefined ? { subject } : {}),
    },
  })

  // Notify author on status change
  if (status && status !== problem.status && problem.authorId !== session.user.id) {
    const notifMsg = status === 'APPROVED'
      ? `문제 "${problem.title}"이(가) 승인되었습니다.${approvedPts ? ` (${approvedPts}pt)` : ''}`
      : `문제 "${problem.title}"이(가) 반려되었습니다.`
    await prisma.notification.create({
      data: {
        userId: problem.authorId,
        type: 'PROBLEM_APPROVED',
        title: status === 'APPROVED' ? '문제 승인됨' : '문제 반려됨',
        content: notifMsg,
        link: `/problems/${problem.id}`,
      },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!session.user.isOwner) {
    return NextResponse.json({ error: '최고 관리자만 삭제할 수 있습니다' }, { status: 403 })
  }

  await prisma.problem.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = session?.user?.id

  const problem = await prisma.problem.findUnique({
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

  const { status, approvedPts } = await req.json()

  const updated = await prisma.problem.update({
    where: { id: params.id },
    data: {
      ...(status ? { status } : {}),
      ...(approvedPts !== undefined ? { approvedPts } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = problem.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'

  // Author can delete only if PENDING; admin can always delete
  if (!isAdmin && !(isAuthor && problem.status === 'PENDING')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.problem.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

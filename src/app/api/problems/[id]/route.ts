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
      where: { problemId_userId: { problemId: problem.id, userId } },
    })
  }

  // Get correct count
  const correctCount = await prisma.problemSubmission.count({
    where: { problemId: problem.id, correct: true },
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

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'ADMIN'
  const isAuthor = problem.authorId === session.user.id
  if (!isAdmin && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, approvedPts, title, content, answer, extraAnswers, subAnswers, subject } = await req.json()

  // status/approvedPts 변경은 관리자만 가능
  const adminOnlyFields = isAdmin
    ? { ...(status ? { status } : {}), ...(approvedPts !== undefined ? { approvedPts } : {}) }
    : {}

  const updated = await prisma.problem.update({
    where: { id: params.id },
    data: {
      ...adminOnlyFields,
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(extraAnswers !== undefined ? { extraAnswers: JSON.stringify(extraAnswers) } : {}),
      ...(subAnswers !== undefined ? { subAnswers: JSON.stringify(subAnswers) } : {}),
      ...(subject !== undefined ? { subject } : {}),
    },
  })

  // Status change (admin action)
  if (isAdmin && status && status !== problem.status) {
    const effectivePts = approvedPts ?? problem.approvedPts ?? problem.requestedPts ?? 0
    const isApproved = status === 'APPROVED'

    // 상점 포인트: 문제 승인 시 출제자에게 지급 (소유자 포함 모두. 단 이미 승인→재승인 방지)
    if (isApproved && effectivePts > 0) {
      await prisma.user.update({
        where: { id: problem.authorId },
        data: { shopPoints: { increment: effectivePts } },
      })
    }

    // 알림: 관리자가 본인 문제를 처리한 경우엔 자기 자신에게 알림 불필요
    if (problem.authorId !== session.user.id) {
      const notifMsg = isApproved
        ? `문제 "${problem.title}"이(가) 승인되었습니다.${effectivePts ? ` (+${effectivePts} 상점 포인트)` : ''}`
        : `문제 "${problem.title}"이(가) 반려되었습니다.`
      await prisma.notification.create({
        data: {
          userId: problem.authorId,
          type: 'PROBLEM_APPROVED',
          title: isApproved ? '문제 승인됨' : '문제 반려됨',
          content: notifMsg,
          link: `/problems/${problem.id}`,
        },
      })
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '관리자만 삭제할 수 있습니다' }, { status: 403 })
  }

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.problem.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

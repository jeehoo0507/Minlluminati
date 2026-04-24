import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: 검토자/출제자/어드민이 서술형 제출 목록 조회
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: { select: { userId: true } } },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  const isContributor = contest.contributors.some((c) => c.userId === session.user.id)

  if (!isOrganizer && !isAdmin && !isContributor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const submissions = await prisma.contestEssaySubmission.findMany({
    where: { problem: { contestId: params.id } },
    include: {
      user: { select: { id: true, name: true, image: true, points: true } },
      problem: { select: { id: true, label: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ submissions })
}

// POST: 참가자가 서술형 답안 제출
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest || contest.status !== 'ONGOING') {
    return NextResponse.json({ error: '진행 중인 대회가 아닙니다' }, { status: 400 })
  }

  const participant = await prisma.contestParticipant.findUnique({
    where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
  })
  if (!participant) return NextResponse.json({ error: '먼저 대회에 참가하세요' }, { status: 400 })

  const { problemId, content, imageUrls } = await req.json()
  if (!problemId) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  if (!content?.trim() && (!imageUrls || imageUrls.length === 0)) {
    return NextResponse.json({ error: '답안 내용 또는 이미지를 첨부하세요' }, { status: 400 })
  }

  const problem = await prisma.contestProblem.findUnique({ where: { id: problemId } })
  if (!problem || problem.contestId !== params.id || !problem.isEssay) {
    return NextResponse.json({ error: '서술형 문제가 아닙니다' }, { status: 400 })
  }

  const submission = await prisma.contestEssaySubmission.upsert({
    where: { problemId_userId: { problemId, userId: session.user.id } },
    create: {
      problemId,
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

// PATCH: 검토자/어드민이 서술형 답안 승인/반려
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: { select: { userId: true } } },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  const isContributor = contest.contributors.some((c) => c.userId === session.user.id)

  if (!isOrganizer && !isAdmin && !isContributor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { submissionId, status } = await req.json()
  if (!submissionId || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const essaySub = await prisma.contestEssaySubmission.findUnique({
    where: { id: submissionId },
    include: { problem: true },
  })
  if (!essaySub || essaySub.problem.contestId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.contestEssaySubmission.update({
    where: { id: submissionId },
    data: { status },
  })

  const isSubmitterStaff = essaySub.userId === contest.organizerId ||
    contest.contributors.some((c) => c.userId === essaySub.userId)

  if (!isSubmitterStaff) {
    // 승인 시 점수 부여
    if (status === 'APPROVED' && essaySub.status !== 'APPROVED') {
      await prisma.contestParticipant.updateMany({
        where: { contestId: params.id, userId: essaySub.userId },
        data: { score: { increment: essaySub.problem.points } },
      })
    }
    // 승인 취소 시 점수 회수
    if (status === 'REJECTED' && essaySub.status === 'APPROVED') {
      await prisma.contestParticipant.updateMany({
        where: { contestId: params.id, userId: essaySub.userId },
        data: { score: { decrement: essaySub.problem.points } },
      })
    }
  }

  return NextResponse.json({ ok: true })
}

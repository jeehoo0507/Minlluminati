import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; problemId: string } }
) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: true },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  const isContributor = contest.contributors.some(
    (c) => c.userId === session.user!.id && c.role === 'CONTRIBUTOR'
  )

  if (!isOrganizer && !isAdmin && !isContributor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (['ONGOING', 'ENDED'].includes(contest.status)) {
    return NextResponse.json({ error: '진행 중이거나 종료된 대회는 수정할 수 없습니다' }, { status: 400 })
  }

  const { title, content, answer, extraAnswers, subAnswers, points, label, imageUrls, allowRetry, isEssay } = await req.json()

  const updated = await prisma.contestProblem.update({
    where: { id: params.problemId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(extraAnswers !== undefined ? { extraAnswers: JSON.stringify(extraAnswers) } : {}),
      ...(subAnswers !== undefined ? { subAnswers: JSON.stringify(subAnswers) } : {}),
      ...(points !== undefined ? { points: Number(points) } : {}),
      ...(label !== undefined ? { label } : {}),
      ...(imageUrls !== undefined ? { imageUrls: JSON.stringify(imageUrls) } : {}),
      ...(allowRetry !== undefined ? { allowRetry } : {}),
      ...(isEssay !== undefined ? { isEssay: Boolean(isEssay) } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; problemId: string } }
) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: true },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'

  if (!isOrganizer && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (['ONGOING', 'ENDED'].includes(contest.status)) {
    return NextResponse.json({ error: '진행 중이거나 종료된 대회의 문제는 삭제할 수 없습니다' }, { status: 400 })
  }

  await prisma.contestProblem.delete({ where: { id: params.problemId } })
  return NextResponse.json({ ok: true })
}

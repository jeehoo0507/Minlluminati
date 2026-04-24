import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: true, problems: { orderBy: { order: 'asc' } } },
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
    return NextResponse.json({ error: '진행 중이거나 종료된 대회에는 문제를 추가할 수 없습니다' }, { status: 400 })
  }

  const { title, content, answer, extraAnswers, subAnswers, points, imageUrls, allowRetry, isEssay } = await req.json()

  const subAnswerDefs: { label: string; answer: string; extra?: string[] }[] = Array.isArray(subAnswers) ? subAnswers : []
  const isMultiPart = subAnswerDefs.length > 0
  const essayMode = isEssay === true

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용은 필수입니다' }, { status: 400 })
  }
  if (!essayMode && !isMultiPart && !answer?.trim()) {
    return NextResponse.json({ error: '정답을 입력해주세요' }, { status: 400 })
  }

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const nextOrder = contest.problems.length
  const label = labels[nextOrder] ?? String(nextOrder + 1)

  const problem = await prisma.contestProblem.create({
    data: {
      contestId: params.id,
      label,
      title: title.trim(),
      content: content.trim(),
      answer: essayMode ? '[essay]' : (isMultiPart ? '[multi-part]' : answer.trim()),
      extraAnswers: JSON.stringify(Array.isArray(extraAnswers) ? extraAnswers : []),
      subAnswers: JSON.stringify(essayMode ? [] : subAnswerDefs),
      points: Number(points) || 100,
      imageUrls: JSON.stringify(Array.isArray(imageUrls) ? imageUrls : []),
      allowRetry: allowRetry !== false,
      isEssay: essayMode,
      order: nextOrder,
    },
  })

  return NextResponse.json(problem, { status: 201 })
}

// PATCH: 문제 순서 일괄 변경 (드래그 앤 드롭)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
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
    return NextResponse.json({ error: '진행 중이거나 종료된 대회는 순서를 변경할 수 없습니다' }, { status: 400 })
  }

  // orderedIds: 새로운 순서로 정렬된 문제 id 배열
  const { orderedIds } = await req.json()
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  await prisma.$transaction(
    orderedIds.map((problemId: string, index: number) =>
      prisma.contestProblem.update({
        where: { id: problemId },
        data: { order: index, label: labels[index] ?? String(index + 1) },
      })
    )
  )

  return NextResponse.json({ ok: true })
}

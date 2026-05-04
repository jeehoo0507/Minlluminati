import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { checkUploadBadges } from '@/lib/awardBadge'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')
  const search = searchParams.get('q')
  const author = searchParams.get('author')
  const sort = searchParams.get('sort') ?? 'number_desc'
  const solved = searchParams.get('solved') // 'solved' | 'unsolved' | null
  const contestOnly = searchParams.get('contest') === 'true'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const session = await getAuth()
  const userId = session?.user?.id
  const isAdmin = session?.user?.role === 'ADMIN'

  // Build visibility clause: approved for public, or own pending problems
  const visibilityClause = isAdmin
    ? undefined
    : userId
      ? { OR: [{ status: 'APPROVED' }, { authorId: userId }] }
      : { status: 'APPROVED' }

  // Build AND conditions array
  const andClauses: Record<string, unknown>[] = []
  if (visibilityClause) andClauses.push(visibilityClause)
  if (subject) andClauses.push({ subject })
  if (contestOnly) andClauses.push({ contestId: { not: null } })
  if (search) {
    const hashMatch = search.trim().match(/^#(\d+)$/)
    if (hashMatch) {
      // #번호 → 문제 번호 정확 검색
      andClauses.push({ problemNumber: parseInt(hashMatch[1]) })
    } else {
      andClauses.push({ OR: [{ title: { contains: search } }, { content: { contains: search } }] })
    }
  }
  if (author) andClauses.push({ author: { name: { contains: author } } })

  // 푼 / 안 푼 필터: userId 기반으로 정답 제출 여부 확인
  if (solved && userId) {
    const correctSubs = await prisma.problemSubmission.findMany({
      where: { userId, correct: true },
      select: { problemId: true },
    })
    const solvedIds = correctSubs.map((s) => s.problemId)
    if (solved === 'solved') {
      andClauses.push({ id: { in: solvedIds.length > 0 ? solvedIds : ['__none__'] } })
    } else if (solved === 'unsolved') {
      andClauses.push({ id: { notIn: solvedIds } })
    }
  }

  const where = andClauses.length === 0 ? {} : andClauses.length === 1 ? andClauses[0] : { AND: andClauses }

  const orderBy =
    sort === 'number_asc' ? { problemNumber: 'asc' as const } :
    { problemNumber: 'desc' as const }

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        author: { select: { id: true, name: true, image: true, points: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.problem.count({ where }),
  ])

  // Calculate solve rates — single query instead of N+1
  const problemIds = problems.map((p) => p.id)
  const correctCounts = await prisma.problemSubmission.groupBy({
    by: ['problemId'],
    where: { problemId: { in: problemIds }, correct: true },
    _count: { problemId: true },
  })
  const correctMap: Record<string, number> = {}
  for (const c of correctCounts) correctMap[c.problemId] = c._count.problemId

  const problemsWithStats = problems.map((p) => {
    const correctCount = correctMap[p.id] ?? 0
    return {
      ...p,
      solveRate: p._count.submissions > 0 ? Math.round((correctCount / p._count.submissions) * 100) : 0,
      correctCount,
    }
  })

  return NextResponse.json({ problems: problemsWithStats, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, answer, subject, imageUrls, requestedPts, subAnswers, isEssay } = await req.json()

  const subAnswerDefs: { label: string; answer: string; extra?: string[] }[] = Array.isArray(subAnswers) ? subAnswers : []
  const essayMode = Boolean(isEssay)
  const isMultiPart = !essayMode && subAnswerDefs.length > 0

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용은 필수입니다' }, { status: 400 })
  }
  if (title.trim().length > 200) return NextResponse.json({ error: '제목은 200자 이하여야 합니다' }, { status: 400 })
  if (content.trim().length > 20000) return NextResponse.json({ error: '내용은 20000자 이하여야 합니다' }, { status: 400 })
  if (!essayMode && !isMultiPart && !answer?.trim()) {
    return NextResponse.json({ error: '정답을 입력해주세요' }, { status: 400 })
  }
  if (isMultiPart && subAnswerDefs.some((s) => !s.answer?.trim())) {
    return NextResponse.json({ error: '모든 답변 슬롯에 정답을 입력해주세요' }, { status: 400 })
  }

  const maxResult = await prisma.problem.aggregate({ _max: { problemNumber: true } })
  const nextNumber = (maxResult._max.problemNumber ?? 0) + 1

  const problem = await prisma.problem.create({
    data: {
      problemNumber: nextNumber,
      title: title.trim(),
      content: content.trim(),
      answer: essayMode ? '[essay]' : isMultiPart ? '[multi-part]' : answer.trim(),
      subject: subject ?? null,
      imageUrls: JSON.stringify(imageUrls ?? []),
      requestedPts: requestedPts ?? 0,
      subAnswers: JSON.stringify(isMultiPart ? subAnswerDefs : []),
      isEssay: essayMode,
      authorId: session.user.id,
      status: 'PENDING',
    },
  })

  checkUploadBadges(session.user.id).catch(() => {})
  return NextResponse.json(problem, { status: 201 })
}

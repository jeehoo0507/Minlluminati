import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')
  const search = searchParams.get('q')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const session = await getAuth()
  const userId = session?.user?.id
  const isAdmin = session?.user?.role === 'ADMIN'

  // Build where clause: approved for public, or own pending problems
  let where: Record<string, unknown> = {}

  if (isAdmin) {
    // Admins see everything
    where = {}
  } else if (userId) {
    where = {
      OR: [
        { status: 'APPROVED' },
        { authorId: userId },
      ],
    }
  } else {
    where = { status: 'APPROVED' }
  }

  if (subject) where = { ...where, subject }
  if (search) {
    const searchClause = {
      OR: [
        { title: { contains: search } },
        { content: { contains: search } },
      ],
    }
    where = { ...where, ...searchClause }
  }

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy: { problemNumber: 'asc' },
      skip,
      take: limit,
      include: {
        author: { select: { id: true, name: true, image: true, points: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.problem.count({ where }),
  ])

  // Calculate solve rates
  const problemsWithStats = await Promise.all(
    problems.map(async (p) => {
      const correctCount = await prisma.problemSubmission.count({
        where: { problemId: p.id, correct: true },
      })
      return {
        ...p,
        solveRate: p._count.submissions > 0 ? Math.round((correctCount / p._count.submissions) * 100) : 0,
        correctCount,
      }
    })
  )

  return NextResponse.json({ problems: problemsWithStats, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, answer, subject, imageUrls, requestedPts } = await req.json()

  if (!title?.trim() || !content?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: '제목, 내용, 정답은 필수입니다' }, { status: 400 })
  }

  const maxResult = await prisma.problem.aggregate({ _max: { problemNumber: true } })
  const nextNumber = (maxResult._max.problemNumber ?? 0) + 1

  const problem = await prisma.problem.create({
    data: {
      problemNumber: nextNumber,
      title: title.trim(),
      content: content.trim(),
      answer: answer.trim(),
      subject: subject ?? null,
      imageUrls: JSON.stringify(imageUrls ?? []),
      requestedPts: requestedPts ?? 0,
      authorId: session.user.id,
      status: 'PENDING',
    },
  })

  return NextResponse.json(problem, { status: 201 })
}

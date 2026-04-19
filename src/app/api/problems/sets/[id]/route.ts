import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = session?.user?.id

  const set = await prisma.problemSet.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          problem: {
            include: {
              author: { select: { id: true, name: true, image: true, points: true } },
              _count: { select: { submissions: true } },
            },
          },
        },
      },
    },
  })

  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!set.isPublic && set.authorId !== userId && session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Per-problem: correct submission count + current user's solve status
  const problemIds = set.items.map((item) => item.problem.id)

  const [correctCounts, userSubmissions] = await Promise.all([
    prisma.problemSubmission.groupBy({
      by: ['problemId'],
      where: { problemId: { in: problemIds }, correct: true },
      _count: { _all: true },
    }),
    userId
      ? prisma.problemSubmission.findMany({
          where: { problemId: { in: problemIds }, userId },
          select: { problemId: true, correct: true },
        })
      : Promise.resolve([]),
  ])

  const correctMap = Object.fromEntries(correctCounts.map((r) => [r.problemId, r._count._all]))
  const userSolvedSet = new Set(
    (userSubmissions as { problemId: string; correct: boolean }[])
      .filter((s) => s.correct)
      .map((s) => s.problemId)
  )
  const userTriedSet = new Set(
    (userSubmissions as { problemId: string; correct: boolean }[]).map((s) => s.problemId)
  )

  const itemsWithProgress = set.items.map((item) => ({
    ...item,
    solved: userSolvedSet.has(item.problem.id),
    tried: userTriedSet.has(item.problem.id),
    correctCount: correctMap[item.problem.id] ?? 0,
  }))

  const solvedCount = itemsWithProgress.filter((i) => i.solved).length

  return NextResponse.json({
    ...set,
    items: itemsWithProgress,
    progress: {
      solved: solvedCount,
      total: set.items.length,
      percent: set.items.length > 0 ? Math.round((solvedCount / set.items.length) * 100) : 0,
    },
  })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await prisma.problemSet.findUnique({ where: { id: params.id } })
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = set.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.problemSet.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

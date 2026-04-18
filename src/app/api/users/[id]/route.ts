import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = params.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, image: true, points: true, role: true, createdAt: true,
      _count: { select: { posts: true, comments: true } },
      posts: {
        where: { deletedAt: null },
        select: { id: true, subject: true, pointsAwarded: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Subject breakdown
  const subjectCount: Record<string, number> = {}
  for (const p of user.posts) {
    subjectCount[p.subject] = (subjectCount[p.subject] ?? 0) + 1
  }

  // Streak data: count posts per day for last 365 days
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)
  const streakMap: Record<string, number> = {}
  for (const p of user.posts) {
    const d = new Date(p.createdAt)
    if (d < since) continue
    const key = d.toISOString().slice(0, 10)
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Rivals info
  const myRivals = session?.user
    ? await prisma.rival.findMany({
        where: { userId: session.user.id },
        select: { rivalId: true },
      })
    : []
  const isRival = myRivals.some((r) => r.rivalId === userId)

  // This user's rivals list
  const rivals = await prisma.rival.findMany({
    where: { userId },
    include: { rival: { select: { id: true, name: true, image: true, points: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    ...user,
    posts: user.posts.slice(0, 20),
    subjectCount,
    streakMap,
    isRival,
    rivals: rivals.map((r) => r.rival),
  })
}

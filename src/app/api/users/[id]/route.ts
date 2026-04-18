import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { SUBJECTS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = params.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, image: true, points: true, role: true, createdAt: true,
      _count: { select: { posts: { where: { deletedAt: null } }, comments: true } },
      posts: {
        where: { deletedAt: null },
        select: { id: true, subject: true, pointsAwarded: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Subject breakdown
  const subjectCount: Record<string, number> = {}
  for (const p of user.posts) {
    subjectCount[p.subject] = (subjectCount[p.subject] ?? 0) + 1
  }

  // Streak: count posts per day for last 365 days
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)
  const streakMap: Record<string, number> = {}
  for (const p of user.posts) {
    const d = new Date(p.createdAt)
    if (d < since) continue
    const key = d.toISOString().slice(0, 10)
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Point timeline: monthly cumulative from posts + PointHistory
  const historyEntries = await prisma.pointHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { delta: true, createdAt: true, subject: true },
  })

  // If no history yet (old user), derive from posts
  const rawEvents: { date: Date; delta: number; subject: string | null }[] = historyEntries.length > 0
    ? historyEntries.map((h) => ({ date: new Date(h.createdAt), delta: h.delta, subject: h.subject }))
    : user.posts.map((p) => ({ date: new Date(p.createdAt), delta: p.pointsAwarded, subject: p.subject }))

  rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Build monthly cumulative timeline
  const monthlyMap: Record<string, number> = {}
  let cumulative = 0
  for (const ev of rawEvents) {
    const key = ev.date.toISOString().slice(0, 7) // YYYY-MM
    cumulative += ev.delta
    monthlyMap[key] = cumulative
  }
  // Fill in missing months so the chart is continuous
  const pointTimeline: { month: string; points: number }[] = []
  if (rawEvents.length > 0) {
    const first = rawEvents[0].date
    const now = new Date()
    const cur = new Date(first.getFullYear(), first.getMonth(), 1)
    let prev = 0
    while (cur <= now) {
      const key = cur.toISOString().slice(0, 7)
      const val = monthlyMap[key] ?? prev
      pointTimeline.push({ month: key, points: val })
      prev = val
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  // Radar data: group by category
  const RADAR_AXES = [
    { label: '공통수학 1', keys: ['MATH1'] },
    { label: '공통수학 2', keys: ['MATH2'] },
    { label: '증명/자유', keys: ['PROOF', 'FREE', 'TIPS'] },
    { label: '과학', keys: ['PHYSICS', 'CHEMISTRY', 'EARTH'] },
    { label: '정보', keys: ['CS'] },
    { label: '커뮤니티', keys: ['QUESTION', 'BOARD'] },
  ]
  const radarData = RADAR_AXES.map(({ label, keys }) => ({
    label,
    value: keys.reduce((s, k) => s + (subjectCount[k] ?? 0), 0),
  }))

  // Rivals info
  const myRivals = session?.user
    ? await prisma.rival.findMany({ where: { userId: session.user.id }, select: { rivalId: true } })
    : []
  const isRival = myRivals.some((r) => r.rivalId === userId)

  const rivals = await prisma.rival.findMany({
    where: { userId },
    include: { rival: { select: { id: true, name: true, image: true, points: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    ...user,
    posts: user.posts.slice(-20).reverse(),
    subjectCount,
    streakMap,
    pointTimeline,
    radarData,
    isRival,
    rivals: rivals.map((r) => r.rival),
  })
}

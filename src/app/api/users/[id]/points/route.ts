import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const userId = params.id

  const yearStart = new Date(`${year}-01-01T00:00:00+09:00`)
  const yearEnd   = new Date(`${year + 1}-01-01T00:00:00+09:00`)

  // 해당 연도 이전까지 누적 포인트 (시작 기준값)
  const before = await prisma.pointHistory.aggregate({
    where: { userId, createdAt: { lt: yearStart } },
    _sum: { delta: true },
  })
  const startVal = before._sum.delta ?? 0

  // 해당 연도 내 일별 델타
  const entries = await prisma.pointHistory.findMany({
    where: { userId, createdAt: { gte: yearStart, lt: yearEnd } },
    orderBy: { createdAt: 'asc' },
    select: { delta: true, createdAt: true },
  })

  const dailyDeltaMap: Record<string, number> = {}
  for (const e of entries) {
    const key = new Date(e.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    dailyDeltaMap[key] = (dailyDeltaMap[key] ?? 0) + e.delta
  }

  // Jan 1 ~ Dec 31 누적값 배열 (활동 있는 날만 포인트)
  const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const timeline: { date: string; points: number }[] = []
  let cumulative = startVal

  const end = new Date(`${year}-12-31T00:00:00`)
  const cur = new Date(`${year}-01-01T00:00:00`)
  while (cur <= end) {
    const key = cur.toLocaleDateString('sv-SE')
    const isFuture = key > todayKST
    if (!isFuture) {
      cumulative += dailyDeltaMap[key] ?? 0
      timeline.push({ date: key, points: cumulative })
    }
    cur.setDate(cur.getDate() + 1)
  }

  return NextResponse.json({ timeline, year })
}

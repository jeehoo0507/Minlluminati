import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

  const [todaySessions, allSessions] = await Promise.all([
    prisma.studySession.findMany({ where: { userId, date: todayKST } }),
    prisma.studySession.findMany({ where: { userId } }),
  ])

  const todayTotal = todaySessions.reduce((s, r) => s + r.duration, 0)
  const allTotal = allSessions.reduce((s, r) => s + r.duration, 0)

  // Daily breakdown for chart (last 30 days)
  const daily: Record<string, number> = {}
  for (const s of allSessions) {
    daily[s.date] = (daily[s.date] ?? 0) + s.duration
  }

  return NextResponse.json({ todayTotal, allTotal, daily })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { duration } = await req.json()
  if (!duration || duration < 1) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  const dateKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  await prisma.studySession.create({
    data: { userId: session.user.id, duration: Math.round(duration), date: dateKST },
  })
  return NextResponse.json({ ok: true })
}

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
    prisma.studySession.findMany({
      where: { userId, date: todayKST },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.studySession.findMany({ where: { userId } }),
  ])

  const todayTotal = todaySessions.reduce((s, r) => s + r.duration, 0)
  const allTotal = allSessions.reduce((s, r) => s + r.duration, 0)

  // Daily breakdown (last 30 days)
  const daily: Record<string, number> = {}
  for (const s of allSessions) {
    daily[s.date] = (daily[s.date] ?? 0) + s.duration
  }

  // 과목별 누적 (전체)
  const subjectMap: Record<string, number> = {}
  for (const s of allSessions) {
    if (s.subject) subjectMap[s.subject] = (subjectMap[s.subject] ?? 0) + s.duration
  }

  return NextResponse.json({
    todayTotal, allTotal, daily,
    todaySessions: todaySessions.map((s) => ({
      id: s.id, duration: s.duration, subject: s.subject,
      memo: s.memo, startedAt: s.startedAt,
    })),
    subjectMap,
  })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { duration, subject, memo, startedAt } = await req.json() as {
    duration: number; subject?: string; memo?: string; startedAt?: number
  }
  if (!duration || duration < 1) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  const dateKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  await prisma.studySession.create({
    data: {
      userId: session.user.id,
      duration: Math.round(duration),
      date: dateKST,
      subject: subject || null,
      memo: memo || null,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
    },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json() as { id: string }
  await prisma.studySession.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}

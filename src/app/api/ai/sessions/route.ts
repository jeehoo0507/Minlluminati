import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: 세션 목록 (최신순)
export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.aiSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json(sessions)
}

// POST: 새 세션 생성
export async function POST() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 구독 확인
  const sub = await prisma.aiSubscription.findUnique({ where: { userId: session.user.id } })
  if (!sub || sub.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'AI 구독이 필요합니다' }, { status: 403 })
  }

  const newSession = await prisma.aiSession.create({
    data: { userId: session.user.id, title: '새 대화' },
  })

  return NextResponse.json(newSession)
}

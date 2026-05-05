import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/ai/history?sessionId=xxx — 세션 메시지 조회
export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // 세션 소유권 확인
  const aiSession = await prisma.aiSession.findUnique({ where: { id: sessionId } })
  if (!aiSession || aiSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const messages = await prisma.aiMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    imageUrls: JSON.parse(m.imageUrls),
    createdAt: m.createdAt,
  })))
}

// DELETE /api/ai/history?sessionId=xxx — 세션 메시지만 전체 삭제 (세션 유지)
export async function DELETE(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const aiSession = await prisma.aiSession.findUnique({ where: { id: sessionId } })
  if (!aiSession || aiSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.aiMessage.deleteMany({ where: { sessionId } })
  return NextResponse.json({ ok: true })
}

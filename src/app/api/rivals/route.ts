import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rivals = await prisma.rival.findMany({
    where: { userId: session.user.id },
    include: { rival: { select: { id: true, name: true, image: true, points: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(rivals.map((r) => r.rival))
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rivalId } = await req.json()
  if (!rivalId) return NextResponse.json({ error: 'rivalId required' }, { status: 400 })
  if (rivalId === session.user.id) return NextResponse.json({ error: '자기 자신을 라이벌로 등록할 수 없습니다' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: rivalId } })
  if (!target) return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })

  const existing = await prisma.rival.findUnique({ where: { userId_rivalId: { userId: session.user.id, rivalId } } })
  if (existing) return NextResponse.json({ error: '이미 라이벌로 등록되어 있습니다' }, { status: 409 })

  await prisma.rival.create({ data: { userId: session.user.id, rivalId } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rivalId } = await req.json()
  await prisma.rival.deleteMany({ where: { userId: session.user.id, rivalId } })
  return NextResponse.json({ ok: true })
}

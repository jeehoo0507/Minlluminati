import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin()
  const organizers = await prisma.contestOrganizer.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { grantedAt: 'desc' },
  })
  return NextResponse.json(organizers)
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: '해당 이메일의 유저를 찾을 수 없습니다' }, { status: 404 })

  const organizer = await prisma.contestOrganizer.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json(organizer)
}

export async function DELETE(req: NextRequest) {
  await requireAdmin()
  const { userId } = await req.json()
  await prisma.contestOrganizer.deleteMany({ where: { userId } })
  return NextResponse.json({ ok: true })
}

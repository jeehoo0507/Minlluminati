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
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: '유저 ID 필요' }, { status: 400 })

  const organizer = await prisma.contestOrganizer.upsert({
    where: { userId },
    create: { userId },
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

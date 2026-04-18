import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  const { role } = await req.json()
  if (!['USER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: '잘못된 역할입니다' }, { status: 400 })
  }
  const user = await prisma.user.update({ where: { id: params.id }, data: { role } })
  return NextResponse.json({ id: user.id, role: user.role })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

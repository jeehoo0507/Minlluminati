import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin()
  const emails = await prisma.allowedEmail.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(emails)
}

export async function DELETE(req: NextRequest) {
  await requireAdmin()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  await prisma.allowedEmail.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

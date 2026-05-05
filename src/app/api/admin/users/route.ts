import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  await requireAdmin()
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, points: true, createdAt: true, image: true, aiDisabled: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })

  const existing = await prisma.allowedEmail.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: '이미 추가된 이메일입니다' }, { status: 409 })

  const allowed = await prisma.allowedEmail.create({ data: { email } })
  return NextResponse.json(allowed, { status: 201 })
}

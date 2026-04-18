import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, name, message } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })

  const existing = await prisma.allowedEmail.findUnique({ where: { email: email.trim() } })
  if (existing) return NextResponse.json({ error: '이미 초대된 이메일입니다' }, { status: 400 })

  await prisma.permissionRequest.upsert({
    where: { email: email.trim() },
    create: { email: email.trim(), name: name?.trim() ?? null, message: message?.trim() ?? null, status: 'PENDING' },
    update: { name: name?.trim() ?? null, message: message?.trim() ?? null, status: 'PENDING' },
  })

  return NextResponse.json({ ok: true })
}

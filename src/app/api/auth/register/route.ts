import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json()

  if (!email || !password || !name) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 })
  }

  const allowed = await prisma.allowedEmail.findUnique({ where: { email } })
  if (!allowed) {
    return NextResponse.json({ error: '초대된 이메일이 아닙니다. 관리자에게 문의하세요' }, { status: 403 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })
  }

  const nameConflict = await prisma.user.findFirst({ where: { name } })
  if (nameConflict) {
    return NextResponse.json({ error: '이미 사용 중인 닉네임입니다' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { email, name, password: hashed, passwordSet: true, role: 'USER' },
  })

  await prisma.allowedEmail.update({ where: { email }, data: { usedAt: new Date() } })

  return NextResponse.json({ ok: true })
}

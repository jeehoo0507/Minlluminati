import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { checkRateLimit } from '@/lib/rateLimit'

// 이메일 형식 검증 (RFC 5322 간략 버전)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 닉네임: 2~20자, 한글/영문/숫자/언더스코어/하이픈만 허용
const NAME_REGEX = /^[가-힣a-zA-Z0-9_\-]{2,20}$/

export async function POST(req: NextRequest) {
  // Rate limiting: IP당 15분에 10회
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  if (!checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
      { status: 429 }
    )
  }

  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const { email, password, name } = body

  if (!email || !password || !name) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
  }

  // 이메일 형식 검증
  if (!EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: '유효하지 않은 이메일 형식입니다' }, { status: 400 })
  }

  // 이메일 길이 제한
  if (email.trim().length > 200) {
    return NextResponse.json({ error: '이메일이 너무 깁니다' }, { status: 400 })
  }

  // 비밀번호: 최소 8자
  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다' }, { status: 400 })
  }
  if (password.length > 128) {
    return NextResponse.json({ error: '비밀번호가 너무 깁니다' }, { status: 400 })
  }

  // 닉네임 검증
  if (!NAME_REGEX.test(name.trim())) {
    return NextResponse.json(
      { error: '닉네임은 2~20자이며, 한글/영문/숫자/언더스코어(_)/하이픈(-)만 사용 가능합니다' },
      { status: 400 }
    )
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()

  const allowed = await prisma.allowedEmail.findUnique({ where: { email: normalizedEmail } })
  if (!allowed) {
    return NextResponse.json({ error: '초대된 이메일이 아닙니다. 관리자에게 문의하세요' }, { status: 403 })
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })
  }

  const nameConflict = await prisma.user.findFirst({ where: { name: normalizedName } })
  if (nameConflict) {
    return NextResponse.json({ error: '이미 사용 중인 닉네임입니다' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { email: normalizedEmail, name: normalizedName, password: hashed, passwordSet: true, role: 'USER' },
  })

  await prisma.allowedEmail.update({ where: { email: normalizedEmail }, data: { usedAt: new Date() } })

  return NextResponse.json({ ok: true })
}

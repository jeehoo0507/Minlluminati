import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { password } = await req.json()
  if (!password) return NextResponse.json({ ok: false }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } })
  if (!user?.password) return NextResponse.json({ ok: false }, { status: 400 })

  const valid = await bcrypt.compare(password, user.password)
  return NextResponse.json({ ok: valid }, { status: valid ? 200 : 401 })
}

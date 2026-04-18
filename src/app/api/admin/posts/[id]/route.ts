import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revokeAllPostPoints } from '@/lib/scoring'
import bcrypt from 'bcryptjs'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { adminPassword } = await req.json()
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } })
  if (!admin?.password || !(await bcrypt.compare(adminPassword, admin.password))) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await revokeAllPostPoints(params.id)
  await prisma.post.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

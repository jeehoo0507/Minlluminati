import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const groups = await prisma.group.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, posts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(groups)
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, adminPassword } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } })
  if (!admin?.password || !(await bcrypt.compare(adminPassword, admin.password))) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다' }, { status: 401 })
  }

  const group = await prisma.group.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.group.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

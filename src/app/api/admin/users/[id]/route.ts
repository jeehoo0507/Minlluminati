import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

async function verifyAdminPassword(adminId: string, password: string) {
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { password: true } })
  if (!admin?.password) return false
  return bcrypt.compare(password, admin.password)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()

  // Role change — no password needed
  if (body.role !== undefined) {
    if (!['USER', 'ADMIN'].includes(body.role)) {
      return NextResponse.json({ error: '잘못된 역할입니다' }, { status: 400 })
    }
    const user = await prisma.user.update({ where: { id: params.id }, data: { role: body.role } })
    return NextResponse.json({ id: user.id, role: user.role })
  }

  // Points edit — requires admin password
  if (body.points !== undefined) {
    if (!body.adminPassword) {
      return NextResponse.json({ error: '관리자 비밀번호가 필요합니다' }, { status: 400 })
    }
    if (!(await verifyAdminPassword(session.user.id, body.adminPassword))) {
      return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다' }, { status: 401 })
    }
    const points = Number(body.points)
    if (isNaN(points) || points < 0) {
      return NextResponse.json({ error: '유효하지 않은 점수입니다' }, { status: 400 })
    }
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { points: true } })
    const delta = points - (target?.points ?? 0)
    const user = await prisma.user.update({ where: { id: params.id }, data: { points } })
    if (delta !== 0) {
      await prisma.pointHistory.create({
        data: { userId: params.id, delta, reason: '관리자 조정' },
      })
    }
    return NextResponse.json({ id: user.id, points: user.points })
  }

  return NextResponse.json({ error: '변경할 내용이 없습니다' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { adminPassword } = await req.json()
  if (!adminPassword || !(await verifyAdminPassword(session.user.id, adminPassword))) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다' }, { status: 401 })
  }
  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

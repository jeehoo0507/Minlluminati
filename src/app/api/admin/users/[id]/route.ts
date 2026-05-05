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

  // Role change — OWNER only
  if (body.role !== undefined) {
    if (!session.user.isOwner) {
      return NextResponse.json({ error: '역할 변경은 최고 관리자만 가능합니다' }, { status: 403 })
    }
    if (!['USER', 'ADMIN'].includes(body.role)) {
      return NextResponse.json({ error: '잘못된 역할입니다' }, { status: 400 })
    }
    // OWNER 계정은 역할 변경 불가
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } })
    if (target?.role === 'OWNER') {
      return NextResponse.json({ error: '최고 관리자 계정은 변경할 수 없습니다' }, { status: 403 })
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

  // AI 비활성화 토글
  if (body.aiDisabled !== undefined) {
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } })
    if (target?.role === 'OWNER') {
      return NextResponse.json({ error: '최고 관리자는 변경할 수 없습니다' }, { status: 403 })
    }
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { aiDisabled: Boolean(body.aiDisabled) },
    })
    return NextResponse.json({ id: user.id, aiDisabled: user.aiDisabled })
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

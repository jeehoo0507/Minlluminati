import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
export const dynamic = 'force-dynamic'

function isAdmin(session: Awaited<ReturnType<typeof getAuth>>) {
  return session?.user?.role === 'ADMIN'
}

// GET: all badges
export async function GET() {
  const session = await getAuth()
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const badges = await prisma.badge.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json(badges)
}

// POST: create or award badge manually
export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Award badge to a specific user
  if (body.action === 'award') {
    const { userId, badgeId } = body as { userId: string; badgeId: string }
    if (!userId || !badgeId) return NextResponse.json({ error: 'userId, badgeId 필요' }, { status: 400 })
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      create: { userId, badgeId },
      update: {},
    })
    return NextResponse.json({ ok: true })
  }

  // Create badge
  const { key, name, description, imageUrl, title, isHidden, sortOrder } = body as {
    key: string; name: string; description?: string; imageUrl?: string
    title?: string; isHidden?: boolean; sortOrder?: number
  }
  if (!key || !name) return NextResponse.json({ error: 'key, name 필수' }, { status: 400 })
  const badge = await prisma.badge.create({
    data: {
      key, name,
      description: description ?? '',
      imageUrl: imageUrl ?? null,
      title: title ?? null,
      isHidden: isHidden ?? false,
      sortOrder: sortOrder ?? 0,
    },
  })
  return NextResponse.json(badge)
}

// PATCH: update badge
export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { id, key, name, description, imageUrl, title, isHidden, isActive, sortOrder } = body
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })
  const badge = await prisma.badge.update({
    where: { id },
    data: {
      ...(key !== undefined && { key }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(title !== undefined && { title: title || null }),
      ...(isHidden !== undefined && { isHidden }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  })
  return NextResponse.json(badge)
}

// DELETE: delete badge (requires admin password)
export async function DELETE(req: NextRequest) {
  const session = await getAuth()
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, adminPassword } = await req.json() as { id: string; adminPassword?: string }
  if (!adminPassword) return NextResponse.json({ error: '비밀번호를 입력해주세요' }, { status: 400 })
  const admin = await prisma.user.findUnique({ where: { id: session!.user!.id }, select: { password: true } })
  if (!admin?.password || !(await bcrypt.compare(adminPassword, admin.password))) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다' }, { status: 403 })
  }
  await prisma.badge.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

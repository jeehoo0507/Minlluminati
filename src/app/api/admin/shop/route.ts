import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
export const dynamic = 'force-dynamic'

// GET: all banner items + shield price config
export async function GET() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const [banners, shieldPriceCfg] = await Promise.all([
    prisma.bannerItem.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.systemConfig.findUnique({ where: { key: 'shieldPrice' } }),
  ])
  return NextResponse.json({ banners, shieldPrice: shieldPriceCfg ? parseInt(shieldPriceCfg.value) : 30 })
}

// POST: create banner OR give/take shop points to user
export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Give/take shop points
  if (body.action === 'adjustPoints') {
    const { userId, delta } = body as { userId: string; delta: number }
    if (!userId || typeof delta !== 'number') {
      return NextResponse.json({ error: 'userId and delta required' }, { status: 400 })
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { shopPoints: { increment: delta } },
      select: { shopPoints: true },
    })
    return NextResponse.json({ ok: true, newShopPoints: user.shopPoints })
  }

  // Update shield price
  if (body.action === 'setShieldPrice') {
    const { price } = body as { price: number }
    await prisma.systemConfig.upsert({
      where: { key: 'shieldPrice' },
      create: { key: 'shieldPrice', value: String(price) },
      update: { value: String(price) },
    })
    return NextResponse.json({ ok: true })
  }

  // Create banner item
  const { name, description, imageUrl, price, size } = body as {
    name: string; description?: string; imageUrl: string; price: number; size?: string
  }
  if (!name || !imageUrl || !price) {
    return NextResponse.json({ error: '이름, 이미지, 가격은 필수입니다' }, { status: 400 })
  }
  const banner = await prisma.bannerItem.create({
    data: { name, description: description ?? '', imageUrl, price, size: size ?? 'md' },
  })
  return NextResponse.json(banner)
}

// PATCH: update banner item
export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id, name, description, imageUrl, price, isActive, size } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const banner = await prisma.bannerItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(price !== undefined && { price }),
      ...(isActive !== undefined && { isActive }),
      ...(size !== undefined && { size }),
    },
  })
  return NextResponse.json(banner)
}

// DELETE: delete banner item (requires admin password)
export async function DELETE(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id, adminPassword } = await req.json() as { id: string; adminPassword?: string }
  if (!adminPassword) return NextResponse.json({ error: '비밀번호를 입력해주세요' }, { status: 400 })
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { password: true } })
  if (!admin?.password || !(await bcrypt.compare(adminPassword, admin.password))) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다' }, { status: 403 })
  }
  await prisma.bannerItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

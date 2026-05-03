import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

const DEFAULT_SHIELD_PRICE = 30

async function getShieldPrice() {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: 'shieldPrice' } })
  return cfg ? parseInt(cfg.value) : DEFAULT_SHIELD_PRICE
}

// GET: shop data for current user
export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user, banners, ownedBanners, shieldPrice] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { shopPoints: true, streakShieldsOwned: true },
    }),
    prisma.bannerItem.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    prisma.userBanner.findMany({
      where: { userId: session.user.id },
      include: { bannerItem: true },
    }),
    getShieldPrice(),
  ])

  return NextResponse.json({
    shopPoints: user?.shopPoints ?? 0,
    streakShieldsOwned: user?.streakShieldsOwned ?? 0,
    shieldPrice,
    banners,
    ownedBanners,
  })
}

// POST: buy an item
export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, itemId } = await req.json() as { type: 'shield' | 'banner'; itemId?: string }

  if (type === 'shield') {
    const shieldPrice = await getShieldPrice()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { shopPoints: true },
    })
    if (!user || user.shopPoints < shieldPrice) {
      return NextResponse.json({ error: '상점 포인트가 부족합니다' }, { status: 400 })
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        shopPoints: { decrement: shieldPrice },
        streakShieldsOwned: { increment: 1 },
      },
    })
    return NextResponse.json({ ok: true, message: '스트릭 보호막을 구매했습니다' })
  }

  if (type === 'banner') {
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
    const banner = await prisma.bannerItem.findUnique({ where: { id: itemId, isActive: true } })
    if (!banner) return NextResponse.json({ error: '아이템을 찾을 수 없습니다' }, { status: 404 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { shopPoints: true },
    })
    if (!user || user.shopPoints < banner.price) {
      return NextResponse.json({ error: '상점 포인트가 부족합니다' }, { status: 400 })
    }

    // Check if already owned
    const existing = await prisma.userBanner.findUnique({
      where: { userId_bannerItemId: { userId: session.user.id, bannerItemId: itemId } },
    })
    if (existing) return NextResponse.json({ error: '이미 보유한 아이템입니다' }, { status: 400 })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { shopPoints: { decrement: banner.price } },
      }),
      prisma.userBanner.create({
        data: { userId: session.user.id, bannerItemId: itemId },
      }),
    ])
    return NextResponse.json({ ok: true, message: `"${banner.name}" 배너를 구매했습니다` })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

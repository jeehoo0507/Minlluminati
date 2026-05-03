import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// POST: equip or unequip a banner
export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bannerItemId, equip } = await req.json() as { bannerItemId: string; equip: boolean }

  const owned = await prisma.userBanner.findUnique({
    where: { userId_bannerItemId: { userId: session.user.id, bannerItemId } },
  })
  if (!owned) return NextResponse.json({ error: '보유하지 않은 아이템입니다' }, { status: 400 })

  // Unequip all first, then equip the selected one
  if (equip) {
    await prisma.$transaction([
      prisma.userBanner.updateMany({
        where: { userId: session.user.id, isEquipped: true },
        data: { isEquipped: false },
      }),
      prisma.userBanner.update({
        where: { userId_bannerItemId: { userId: session.user.id, bannerItemId } },
        data: { isEquipped: true },
      }),
    ])
  } else {
    await prisma.userBanner.update({
      where: { userId_bannerItemId: { userId: session.user.id, bannerItemId } },
      data: { isEquipped: false },
    })
  }

  return NextResponse.json({ ok: true })
}

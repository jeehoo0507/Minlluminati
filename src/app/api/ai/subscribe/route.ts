import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const AI_PRICE = 1000 // shopPoints
const AI_DAYS = 30

export async function POST() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shopPoints: true },
  })
  if (!user || user.shopPoints < AI_PRICE) {
    return NextResponse.json({ error: `상점 포인트가 부족합니다 (필요: ${AI_PRICE}SP)` }, { status: 400 })
  }

  // 기존 구독이 있으면 만료일 연장, 없으면 새로 생성
  const existing = await prisma.aiSubscription.findUnique({ where: { userId: session.user.id } })
  const now = new Date()
  const base = existing && existing.expiresAt > now ? existing.expiresAt : now
  const expiresAt = new Date(base.getTime() + AI_DAYS * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { shopPoints: { decrement: AI_PRICE } },
    }),
    prisma.aiSubscription.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, expiresAt },
      update: { expiresAt },
    }),
  ])

  return NextResponse.json({ ok: true, expiresAt })
}

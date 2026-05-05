import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { shopPoints: true, aiDisabled: true } }),
    prisma.aiSubscription.findUnique({ where: { userId: session.user.id } }),
  ])

  const now = new Date()
  const subscribed = !!sub && sub.expiresAt > now && !user?.aiDisabled

  return NextResponse.json({
    subscribed,
    expiresAt: sub?.expiresAt ?? null,
    shopPoints: user?.shopPoints ?? 0,
    aiDisabled: user?.aiDisabled ?? false,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json([], { status: 200 })

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(notifications)
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, all } = await req.json()
  if (all) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
  } else if (id) {
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    })
  }
  return NextResponse.json({ ok: true })
}

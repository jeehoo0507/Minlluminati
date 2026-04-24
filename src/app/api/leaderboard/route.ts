import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MASTER_COUNT } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, image: true, points: true, role: true, _count: { select: { posts: { where: { deletedAt: null } } } } },
    orderBy: { points: 'desc' },
    take: 200,
  })
  return NextResponse.json(
    users.map((u, i) => ({ ...u, isMaster: i < MASTER_COUNT }))
  )
}

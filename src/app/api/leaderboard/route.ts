import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MASTER_COUNT } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [users, totalUsers] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, image: true, points: true, role: true, _count: { select: { posts: { where: { deletedAt: null } } } } },
      orderBy: { points: 'desc' },
      take: 200,
    }),
    prisma.user.count(),
  ])

  // 총 유저 수가 MASTER_COUNT 이상일 때만 마스터 티어 활성화
  const masterActive = totalUsers >= MASTER_COUNT

  return NextResponse.json(
    users.map((u, i) => ({ ...u, isMaster: masterActive && i < MASTER_COUNT }))
  )
}

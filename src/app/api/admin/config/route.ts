import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { TIERS, PROBLEM_TIERS, POINTS } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [userTiersCfg, problemTiersCfg, pointsCfg] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: 'tiers' } }),
    prisma.systemConfig.findUnique({ where: { key: 'problemTiers' } }),
    prisma.systemConfig.findUnique({ where: { key: 'points' } }),
  ])
  return NextResponse.json({
    tiers: userTiersCfg ? JSON.parse(userTiersCfg.value) : TIERS,
    problemTiers: problemTiersCfg ? JSON.parse(problemTiersCfg.value) : PROBLEM_TIERS,
    points: pointsCfg ? JSON.parse(pointsCfg.value) : { likeReceived: POINTS.LIKE_RECEIVED, dailyPenalty: 10 },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (body.tiers) {
    await prisma.systemConfig.upsert({
      where: { key: 'tiers' },
      create: { key: 'tiers', value: JSON.stringify(body.tiers) },
      update: { value: JSON.stringify(body.tiers) },
    })
  }
  if (body.problemTiers) {
    await prisma.systemConfig.upsert({
      where: { key: 'problemTiers' },
      create: { key: 'problemTiers', value: JSON.stringify(body.problemTiers) },
      update: { value: JSON.stringify(body.problemTiers) },
    })
  }
  if (body.points) {
    await prisma.systemConfig.upsert({
      where: { key: 'points' },
      create: { key: 'points', value: JSON.stringify(body.points) },
      update: { value: JSON.stringify(body.points) },
    })
  }

  return NextResponse.json({ ok: true })
}

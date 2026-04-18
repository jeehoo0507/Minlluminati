import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { TIERS } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: 'tiers' } })
  if (cfg) return NextResponse.json(JSON.parse(cfg.value))
  return NextResponse.json(TIERS)
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tiers } = await req.json()
  if (!Array.isArray(tiers)) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  await prisma.systemConfig.upsert({
    where: { key: 'tiers' },
    create: { key: 'tiers', value: JSON.stringify(tiers) },
    update: { value: JSON.stringify(tiers) },
  })
  return NextResponse.json({ ok: true })
}

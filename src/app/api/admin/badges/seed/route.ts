import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { BADGE_DEFS } from '@/lib/badgeDefs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let seeded = 0
  for (const def of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { key: def.key },
      create: {
        key: def.key, name: def.name, description: def.description,
        title: def.title ?? null, isHidden: def.isHidden, sortOrder: def.sortOrder,
      },
      update: {
        name: def.name, description: def.description,
        title: def.title ?? null, isHidden: def.isHidden, sortOrder: def.sortOrder,
      },
    })
    seeded++
  }

  return NextResponse.json({ ok: true, seeded })
}

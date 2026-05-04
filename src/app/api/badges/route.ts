import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// GET: my badges + selected state
export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      selectedBadgeIds: true,
      selectedTitleId: true,
      userBadges: {
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      },
    },
  })

  return NextResponse.json({
    ownedBadges: user?.userBadges ?? [],
    selectedBadgeIds: JSON.parse(user?.selectedBadgeIds ?? '[]') as string[],
    selectedTitleId: user?.selectedTitleId ?? null,
  })
}

// PATCH: update selected badges + title
export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selectedBadgeIds, selectedTitleId } = await req.json() as {
    selectedBadgeIds?: string[]
    selectedTitleId?: string | null
  }

  // Validate: selectedTitleId must be one of owned badge IDs (if provided)
  if (selectedTitleId) {
    const owned = await prisma.userBadge.findFirst({
      where: { userId: session.user.id, badgeId: selectedTitleId },
    })
    if (!owned) return NextResponse.json({ error: '보유하지 않은 뱃지입니다' }, { status: 400 })
    // Must have a title
    const badge = await prisma.badge.findUnique({ where: { id: selectedTitleId }, select: { title: true } })
    if (!badge?.title) return NextResponse.json({ error: '칭호가 없는 뱃지입니다' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(selectedBadgeIds !== undefined && { selectedBadgeIds: JSON.stringify(selectedBadgeIds) }),
      ...(selectedTitleId !== undefined && { selectedTitleId: selectedTitleId ?? null }),
    },
  })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin()
  const contests = await prisma.contest.findMany({
    where: { status: 'PENDING' },
    include: { organizer: { select: { id: true, name: true, email: true } }, _count: { select: { problems: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(contests)
}

export async function PATCH(req: NextRequest) {
  await requireAdmin()
  const { contestId, action } = await req.json()
  if (!contestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }
  const updated = await prisma.contest.update({
    where: { id: contestId },
    data: { status: action === 'approve' ? 'APPROVED' : 'DRAFT' },
  })
  return NextResponse.json(updated)
}

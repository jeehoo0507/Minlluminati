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
  const { contestId, action, prize1, prize2, prize3 } = await req.json()
  if (!contestId || !['APPROVED', 'REJECTED'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }
  const updated = await prisma.contest.update({
    where: { id: contestId },
    data: {
      status: action === 'APPROVED' ? 'APPROVED' : 'DRAFT',
      ...(prize1 !== undefined ? { prize1: prize1 ? Number(prize1) : null } : {}),
      ...(prize2 !== undefined ? { prize2: prize2 ? Number(prize2) : null } : {}),
      ...(prize3 !== undefined ? { prize3: prize3 ? Number(prize3) : null } : {}),
    },
  })
  return NextResponse.json(updated)
}

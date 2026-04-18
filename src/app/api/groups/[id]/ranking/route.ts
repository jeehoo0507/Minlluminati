import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id },
    include: { user: { select: { id: true, name: true, image: true, points: true, role: true } } },
    orderBy: { user: { points: 'desc' } },
  })
  return NextResponse.json(members)
}

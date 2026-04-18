import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (contest.organizerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (contest.status !== 'APPROVED') {
    return NextResponse.json({ error: '승인된 대회만 시작할 수 있습니다' }, { status: 400 })
  }

  const updated = await prisma.contest.update({
    where: { id: params.id },
    data: { status: 'ONGOING', startTime: new Date() },
  })
  return NextResponse.json(updated)
}

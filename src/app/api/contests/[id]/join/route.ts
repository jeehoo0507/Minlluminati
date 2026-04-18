import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (contest.status === 'ENDED') return NextResponse.json({ error: '종료된 대회입니다' }, { status: 400 })
  if (!['APPROVED', 'ONGOING'].includes(contest.status)) {
    return NextResponse.json({ error: '참가 신청할 수 없는 대회입니다' }, { status: 400 })
  }

  const participant = await prisma.contestParticipant.upsert({
    where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
    create: { contestId: params.id, userId: session.user.id },
    update: {},
  })
  return NextResponse.json(participant)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.contestParticipant.deleteMany({
    where: { contestId: params.id, userId: session.user.id },
  })
  return NextResponse.json({ ok: true })
}

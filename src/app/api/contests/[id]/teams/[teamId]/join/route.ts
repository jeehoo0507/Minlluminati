import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string; teamId: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (contest.status === 'ENDED') return NextResponse.json({ error: '종료된 대회입니다' }, { status: 400 })

  const team = await prisma.contestTeam.findUnique({
    where: { id: params.teamId },
    include: { members: true },
  })
  if (!team || team.contestId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check not already in another team in this contest
  const existingMembership = await prisma.contestTeamMember.findFirst({
    where: { userId: session.user.id, team: { contestId: params.id } },
  })
  if (existingMembership) return NextResponse.json({ error: '이미 팀에 속해 있습니다' }, { status: 400 })

  // Check team not full (contest.teamSize)
  if (team.members.length >= contest.teamSize) {
    return NextResponse.json({ error: '팀 인원이 가득 찼습니다' }, { status: 400 })
  }

  await prisma.contestTeamMember.create({ data: { teamId: params.teamId, userId: session.user.id } })

  // Auto-register as participant
  await prisma.contestParticipant.upsert({
    where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
    create: { contestId: params.id, userId: session.user.id },
    update: {},
  })

  return NextResponse.json({ ok: true })
}

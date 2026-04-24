import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const teams = await prisma.contestTeam.findMany({
    where: { contestId: params.id },
    include: {
      leader: { select: { id: true, name: true, image: true, points: true } },
      members: {
        include: { user: { select: { id: true, name: true, image: true, points: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
    orderBy: { score: 'desc' },
  })
  return NextResponse.json(teams)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest || !contest.teamContest) return NextResponse.json({ error: 'Not a team contest' }, { status: 400 })
  if (contest.status === 'ENDED') return NextResponse.json({ error: '종료된 대회입니다' }, { status: 400 })

  // Check user not already in a team
  const existing = await prisma.contestTeamMember.findFirst({
    where: { userId: session.user.id, team: { contestId: params.id } },
  })
  if (existing) return NextResponse.json({ error: '이미 팀에 속해 있습니다' }, { status: 400 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '팀 이름을 입력해주세요' }, { status: 400 })

  // Create team + add leader as member + auto-join as participant
  const team = await prisma.contestTeam.create({
    data: {
      contestId: params.id,
      name: name.trim(),
      description: description?.trim() ?? '',
      leaderId: session.user.id,
      members: { create: { userId: session.user.id } },
    },
    include: {
      leader: { select: { id: true, name: true, image: true, points: true } },
      members: { include: { user: { select: { id: true, name: true, image: true, points: true } } } },
    },
  })

  // Auto-register as contest participant
  await prisma.contestParticipant.upsert({
    where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
    create: { contestId: params.id, userId: session.user.id },
    update: {},
  })

  return NextResponse.json(team, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string; teamId: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const team = await prisma.contestTeam.findUnique({
    where: { id: params.teamId },
    include: { members: true },
  })
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Can't leave a full team during ongoing contest
  if (contest.status === 'ONGOING' && team.members.length >= contest.teamSize) {
    return NextResponse.json({ error: '진행 중인 대회에서 인원이 다 찬 팀은 탈퇴할 수 없습니다' }, { status: 400 })
  }

  const membership = await prisma.contestTeamMember.findFirst({
    where: { teamId: params.teamId, userId: session.user.id },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 400 })

  // If leader leaving, transfer leadership or disband
  if (team.leaderId === session.user.id) {
    const others = team.members.filter((m) => m.userId !== session.user.id)
    if (others.length > 0) {
      await prisma.contestTeam.update({
        where: { id: params.teamId },
        data: { leaderId: others[0].userId },
      })
    } else {
      // Last member, disband team
      await prisma.contestTeam.delete({ where: { id: params.teamId } })
      return NextResponse.json({ ok: true })
    }
  }

  await prisma.contestTeamMember.delete({ where: { id: membership.id } })
  return NextResponse.json({ ok: true })
}

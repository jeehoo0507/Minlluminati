import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string; teamId: string } }

async function getTeamMembership(contestId: string, teamId: string, userId: string) {
  const team = await prisma.contestTeam.findFirst({
    where: { id: teamId, contestId },
    include: { members: true },
  })
  if (!team) return null
  const isMember = team.members.some((m) => m.userId === userId) || team.leaderId === userId
  return isMember ? team : null
}

export async function GET(_: NextRequest, { params }: Params) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const team = await getTeamMembership(params.id, params.teamId, session.user.id)
  if (!team) return NextResponse.json({ error: '팀 멤버만 접근 가능합니다' }, { status: 403 })

  const chats = await prisma.contestTeamChat.findMany({
    where: { teamId: params.teamId },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json(chats)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const team = await getTeamMembership(params.id, params.teamId, session.user.id)
  if (!team) return NextResponse.json({ error: '팀 멤버만 채팅 가능합니다' }, { status: 403 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: '내용을 입력하세요' }, { status: 400 })
  if (content.trim().length > 500) return NextResponse.json({ error: '채팅은 500자 이하여야 합니다' }, { status: 400 })

  const chat = await prisma.contestTeamChat.create({
    data: { teamId: params.teamId, authorId: session.user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true, image: true } } },
  })
  return NextResponse.json(chat)
}

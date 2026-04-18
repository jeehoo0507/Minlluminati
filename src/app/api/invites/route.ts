import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json([], { status: 200 })

  const invites = await prisma.groupInvite.findMany({
    where: { invitedEmail: session.user.email!, status: 'PENDING' },
    include: {
      group: { select: { id: true, name: true, avatar: true, isPublic: true, _count: { select: { members: true } } } },
      inviter: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invites)
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inviteId, action } = await req.json()
  if (!inviteId || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } })
  if (!invite || invite.invitedEmail !== session.user.email || invite.status !== 'PENDING') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (action === 'accept') {
    await prisma.$transaction([
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId: session.user.id } },
        create: { groupId: invite.groupId, userId: session.user.id, role: 'MEMBER' },
        update: {},
      }),
      prisma.groupInvite.update({ where: { id: inviteId }, data: { status: 'ACCEPTED' } }),
    ])
  } else {
    await prisma.groupInvite.update({ where: { id: inviteId }, data: { status: 'DECLINED' } })
  }

  return NextResponse.json({ ok: true })
}

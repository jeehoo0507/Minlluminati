import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
  })
  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = group.ownerId === session.user.id
  const isMod = member?.role === 'ADMIN' || isOwner || session.user.role === 'ADMIN'
  if (!isMod) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const { email, query } = await req.json()
  // query: 이메일 또는 닉네임 (email 필드는 하위 호환)
  const searchQuery = (query ?? email ?? '').trim()
  if (!searchQuery) return NextResponse.json({ error: '이메일 또는 닉네임을 입력해주세요' }, { status: 400 })

  // 이메일 또는 닉네임으로 유저 검색
  const targetUser = await prisma.user.findFirst({
    where: { OR: [{ email: searchQuery }, { name: searchQuery }] },
  })
  if (!targetUser) return NextResponse.json({ error: '해당 유저를 찾을 수 없습니다' }, { status: 404 })

  const alreadyMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: targetUser.id } },
  })
  if (alreadyMember) return NextResponse.json({ error: '이미 그룹 멤버입니다' }, { status: 400 })

  const invitedEmail = targetUser.email
  await prisma.groupInvite.upsert({
    where: { groupId_invitedEmail: { groupId: params.id, invitedEmail } },
    create: { groupId: params.id, invitedEmail, invitedBy: session.user.id, status: 'PENDING' },
    update: { status: 'PENDING', invitedBy: session.user.id },
  })

  return NextResponse.json({ ok: true, name: targetUser.name })
}

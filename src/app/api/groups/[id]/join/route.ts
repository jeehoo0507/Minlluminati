import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
    create: { groupId: params.id, userId: session.user.id, role: 'MEMBER' },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (group?.ownerId === session.user.id) {
    return NextResponse.json({ error: '그룹장은 탈퇴할 수 없습니다' }, { status: 400 })
  }
  await prisma.groupMember.deleteMany({ where: { groupId: params.id, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}

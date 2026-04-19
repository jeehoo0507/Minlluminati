import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, image: true, points: true } },
      members: {
        include: { user: { select: { id: true, name: true, image: true, points: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      _count: { select: { posts: true, messages: true } },
    },
  })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const myMembership = session?.user ? group.members.find((m) => m.userId === session.user.id) ?? null : null

  // 비공개 그룹은 멤버 또는 어드민만 접근 가능
  if (!group.isPublic && !myMembership && session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '비공개 그룹입니다. 초대를 통해 가입하세요.' }, { status: 403 })
  }

  return NextResponse.json({ ...group, myMembership })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (group.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { description, avatar, isPublic } = await req.json()
  const updated = await prisma.group.update({
    where: { id: params.id },
    data: {
      ...(description !== undefined ? { description } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.user.isOwner) return NextResponse.json({ error: '최고 관리자만 삭제할 수 있습니다' }, { status: 403 })

  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.group.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

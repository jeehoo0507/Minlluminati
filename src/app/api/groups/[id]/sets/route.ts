import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
  })
  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!group.isPublic && !membership && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sets = await prisma.problemSet.findMany({
    where: { groupId: params.id },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sets })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
  })
  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!membership && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, description, isPublic } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })

  const set = await prisma.problemSet.create({
    data: {
      title: title.trim(),
      description: description?.trim() ?? '',
      isPublic: isPublic ?? false,
      authorId: session.user.id,
      groupId: params.id,
    },
  })

  return NextResponse.json(set)
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  const groups = await prisma.group.findMany({
    where: { isPublic: true },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { members: true, posts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  let myGroupIds: string[] = []
  if (session?.user) {
    const memberships = await prisma.groupMember.findMany({ where: { userId: session.user.id }, select: { groupId: true } })
    myGroupIds = memberships.map((m) => m.groupId)
  }

  return NextResponse.json({ groups, myGroupIds })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, isPublic } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '그룹명을 입력해주세요' }, { status: 400 })

  const existing = await prisma.group.findUnique({ where: { name: name.trim() } })
  if (existing) return NextResponse.json({ error: '이미 사용 중인 그룹명입니다' }, { status: 409 })

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? '',
      isPublic: isPublic !== false,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id, role: 'ADMIN' } },
    },
  })
  return NextResponse.json(group, { status: 201 })
}

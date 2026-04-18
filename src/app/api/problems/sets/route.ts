import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest) {
  const session = await getAuth()
  const userId = session?.user?.id

  let where: Record<string, unknown> = { isPublic: true }

  if (userId) {
    where = {
      OR: [
        { isPublic: true },
        { authorId: userId },
      ],
    }
  }

  const sets = await prisma.problemSet.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json({ sets })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, isPublic, groupId } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })

  const set = await prisma.problemSet.create({
    data: {
      title: title.trim(),
      description: description?.trim() ?? '',
      isPublic: isPublic ?? true,
      authorId: session.user.id,
      groupId: groupId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json(set, { status: 201 })
}

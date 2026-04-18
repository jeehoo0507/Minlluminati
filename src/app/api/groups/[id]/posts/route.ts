import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const posts = await prisma.groupPost.findMany({
    where: { groupId: params.id },
    include: { author: { select: { id: true, name: true, image: true, points: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: '그룹 멤버만 글을 작성할 수 있습니다' }, { status: 403 })

  const { title, content } = await req.json()
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 })

  const post = await prisma.groupPost.create({
    data: { groupId: params.id, authorId: session.user.id, title: title.trim(), content: content.trim() },
    include: { author: { select: { id: true, name: true, image: true, points: true } } },
  })
  return NextResponse.json(post, { status: 201 })
}

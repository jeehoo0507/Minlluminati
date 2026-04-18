import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { postId: params.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
    },
  })
  return NextResponse.json(comments)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })

  const comment = await prisma.comment.create({
    data: { content: content.trim(), authorId: session.user.id, postId: params.id },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
    },
  })
  return NextResponse.json(comment, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await req.json()
  const comment = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (comment.authorId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.comment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { revokeAllPostPoints } from '@/lib/scoring'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      author: { select: { id: true, name: true, image: true, points: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.post.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, content, subject, unit, type } = await req.json()
  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      ...(title ? { title } : {}),
      ...(content ? { content } : {}),
      ...(subject ? { subject } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(type ? { type } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.post.findUnique({ where: { id: params.id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = post.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 관리자가 삭제하면 포인트 환수
  if (isAdmin && !isAuthor) {
    await revokeAllPostPoints(params.id)
  }

  await prisma.post.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

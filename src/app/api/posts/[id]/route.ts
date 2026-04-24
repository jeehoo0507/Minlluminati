import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { revokeAllPostPoints } from '@/lib/scoring'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const isNumber = /^\d+$/.test(params.id)
  const where = isNumber
    ? { postNumber: parseInt(params.id), deletedAt: null as null }
    : { id: params.id, deletedAt: null as null }

  const post = await prisma.post.findFirst({
    where,
    include: {
      author: { select: { id: true, name: true, image: true, points: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

function findWhere(rawId: string) {
  const isNumber = /^\d+$/.test(rawId)
  return isNumber
    ? { postNumber: parseInt(rawId), deletedAt: null as null }
    : { id: rawId, deletedAt: null as null }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.post.findFirst({ where: findWhere(params.id) })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'ADMIN'
  const isOwner = session.user.role === 'OWNER'
  const isAuthor = post.authorId === session.user.id

  if (!isAuthor && !isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, content, subject, unit, type, pinned } = await req.json()

  // 고정/해제는 ADMIN/OWNER만 가능
  if (pinned !== undefined && !isAdmin && !isOwner) {
    return NextResponse.json({ error: '고정 권한이 없습니다' }, { status: 403 })
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      ...(title ? { title } : {}),
      ...(content ? { content } : {}),
      ...(subject ? { subject } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(type ? { type } : {}),
      ...(pinned !== undefined ? { pinned: Boolean(pinned) } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.post.findFirst({ where: findWhere(params.id) })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = post.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 삭제 시 항상 포인트 환수 (본인/관리자 모두)
  await revokeAllPostPoints(post.id)

  await prisma.post.update({
    where: { id: post.id },
    data: { deletedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

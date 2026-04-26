import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/boards/[id] — 보드 + 모든 엘리먼트
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      elements: { orderBy: { zIndex: 'asc' } },
    },
  })

  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })

  const userId = session.user.id
  const isMember = board.ownerId === userId || board.members.some((m) => m.userId === userId)
  if (!board.isPublic && !isMember) {
    return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
  }

  return NextResponse.json(board)
}

// PATCH /api/boards/[id] — 보드 이름/설명 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({ where: { id: params.id } })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })
  if (board.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const { name, description, isPublic } = await req.json()
  const updated = await prisma.board.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(isPublic !== undefined && { isPublic }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/boards/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({ where: { id: params.id } })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })
  if (board.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  await prisma.board.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

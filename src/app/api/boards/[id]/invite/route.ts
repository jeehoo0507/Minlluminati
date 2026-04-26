import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/boards/[id]/invite — 이름 또는 이메일로 멤버 초대
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({ where: { id: params.id } })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })
  if (board.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '초대 권한이 없습니다' }, { status: 403 })
  }

  const { query } = await req.json()
  if (!query?.trim()) return NextResponse.json({ error: '이름 또는 이메일을 입력해주세요' }, { status: 400 })

  const q = query.trim()
  const target = await prisma.user.findFirst({
    where: {
      OR: [
        { email: q },
        { name: q },
      ],
    },
    select: { id: true, name: true, email: true, image: true },
  })
  if (!target) return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  if (target.id === board.ownerId) return NextResponse.json({ error: '보드 소유자는 이미 멤버입니다' }, { status: 400 })

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: params.id, userId: target.id } },
  })
  if (existing) return NextResponse.json({ error: '이미 멤버입니다' }, { status: 400 })

  const member = await prisma.boardMember.create({
    data: { boardId: params.id, userId: target.id, role: 'EDITOR' },
    include: { user: { select: { id: true, name: true, image: true } } },
  })

  return NextResponse.json({ ok: true, member })
}

// DELETE /api/boards/[id]/invite — 멤버 제거
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({ where: { id: params.id } })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })
  if (board.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const { userId } = await req.json()
  await prisma.boardMember.deleteMany({ where: { boardId: params.id, userId } })
  return NextResponse.json({ ok: true })
}

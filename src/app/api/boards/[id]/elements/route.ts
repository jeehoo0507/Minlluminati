import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { boardEmitter } from '@/lib/boardEvents'

// PUT /api/boards/[id]/elements — 전체 엘리먼트 일괄 저장 (autosave)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({
    where: { id: params.id },
    include: { members: { select: { userId: true } } },
  })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })

  const userId = session.user.id
  const isMember = board.ownerId === userId || board.members.some((m) => m.userId === userId)
  if (!isMember && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '편집 권한이 없습니다' }, { status: 403 })
  }

  const { elements } = await req.json() as {
    elements: Array<{
      id?: string
      type: string
      x: number; y: number
      width: number; height: number
      content: string
      style: string
      zIndex: number
    }>
  }

  // 트랜잭션: 기존 전체 삭제 후 재삽입
  await prisma.$transaction([
    prisma.boardElement.deleteMany({ where: { boardId: params.id } }),
    prisma.boardElement.createMany({
      data: elements.map((el) => ({
        id: el.id,
        boardId: params.id,
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        content: el.content ?? '',
        style: typeof el.style === 'string' ? el.style : JSON.stringify(el.style),
        zIndex: el.zIndex ?? 0,
      })),
    }),
    prisma.board.update({ where: { id: params.id }, data: { updatedAt: new Date() } }),
  ])

  // 실시간 브로드캐스트 — 다른 클라이언트에게 변경 알림
  boardEmitter.emit(`board:${params.id}`, {
    type: 'elements',
    userId: session.user.id,
    elements: elements.map((el) => ({
      ...el,
      style: typeof el.style === 'string' ? el.style : JSON.stringify(el.style),
    })),
  })

  return NextResponse.json({ ok: true })
}

// POST /api/boards/[id]/elements — 멤버 추가
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({ where: { id: params.id } })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })

  // 공개 보드는 누구나 참가, 비공개는 오너만 초대 가능 (현재는 단순히 자기자신 추가)
  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId: params.id, userId: session.user.id } },
  })
  if (existing) return NextResponse.json({ ok: true })

  if (!board.isPublic && board.ownerId !== session.user.id) {
    return NextResponse.json({ error: '비공개 보드입니다' }, { status: 403 })
  }

  await prisma.boardMember.create({
    data: { boardId: params.id, userId: session.user.id, role: 'EDITOR' },
  })

  return NextResponse.json({ ok: true })
}

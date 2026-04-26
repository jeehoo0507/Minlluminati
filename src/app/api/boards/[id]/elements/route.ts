import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { boardEmitter } from '@/lib/boardEvents'

// PUT /api/boards/[id]/elements — 요소 upsert + 명시적 삭제
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

  const { elements, deletedIds = [] } = await req.json() as {
    elements: Array<{
      id?: string
      type: string
      x: number; y: number
      width: number; height: number
      content: string
      style: string
      zIndex: number
    }>
    deletedIds?: string[]
  }

  await prisma.$transaction(async (tx) => {
    // 1) 각 요소 upsert — 다른 유저가 추가한 요소는 건드리지 않음
    for (const el of elements) {
      const styleStr = typeof el.style === 'string' ? el.style : JSON.stringify(el.style)
      if (el.id) {
        await tx.boardElement.upsert({
          where: { id: el.id },
          update: {
            type: el.type, x: el.x, y: el.y,
            width: el.width, height: el.height,
            content: el.content ?? '', style: styleStr, zIndex: el.zIndex ?? 0,
          },
          create: {
            id: el.id, boardId: params.id, type: el.type,
            x: el.x, y: el.y, width: el.width, height: el.height,
            content: el.content ?? '', style: styleStr, zIndex: el.zIndex ?? 0,
          },
        })
      } else {
        await tx.boardElement.create({
          data: {
            boardId: params.id, type: el.type,
            x: el.x, y: el.y, width: el.width, height: el.height,
            content: el.content ?? '', style: styleStr, zIndex: el.zIndex ?? 0,
          },
        })
      }
    }

    // 2) 명시적으로 삭제 요청된 ID만 삭제 (notIn 방식 사용 안 함 — 동시 편집 경쟁 방지)
    if (deletedIds.length > 0) {
      await tx.boardElement.deleteMany({
        where: { boardId: params.id, id: { in: deletedIds } },
      })
    }

    // 3) 보드 updatedAt 갱신
    await tx.board.update({ where: { id: params.id }, data: { updatedAt: new Date() } })
  })

  // 실시간 브로드캐스트
  boardEmitter.emit(`board:${params.id}`, {
    type: 'elements',
    userId: session.user.id,
    elements: elements.map((el) => ({
      ...el,
      style: typeof el.style === 'string' ? el.style : JSON.stringify(el.style),
    })),
    deletedIds,
  })

  return NextResponse.json({ ok: true })
}

// POST /api/boards/[id]/elements — 공개 보드 자동 멤버 추가
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({ where: { id: params.id } })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })

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

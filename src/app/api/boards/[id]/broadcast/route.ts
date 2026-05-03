import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { boardEmitter } from '@/lib/boardEvents'

// POST /api/boards/[id]/broadcast — DB 저장 없이 SSE만 브로드캐스트 (빠른 실시간 전달용)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const board = await prisma.board.findUnique({
    where: { id: params.id },
    select: { ownerId: true, members: { select: { userId: true } } },
  })
  if (!board) return NextResponse.json({ error: '보드를 찾을 수 없습니다' }, { status: 404 })

  const userId = session.user.id
  const isMember = board.ownerId === userId || board.members.some((m) => m.userId === userId)
  if (!isMember) return NextResponse.json({ error: '편집 권한이 없습니다' }, { status: 403 })

  const { elements, deletedIds = [] } = await req.json() as {
    elements: Array<{ id?: string; type: string; x: number; y: number; width: number; height: number; content: string; style: string; zIndex: number }>
    deletedIds?: string[]
  }

  // DB 저장 없이 SSE만 브로드캐스트
  boardEmitter.emit(`board:${params.id}`, {
    type: 'elements',
    userId,
    elements: elements.map((el) => ({
      ...el,
      style: typeof el.style === 'string' ? el.style : JSON.stringify(el.style),
    })),
    deletedIds,
  })

  return NextResponse.json({ ok: true })
}

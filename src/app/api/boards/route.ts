import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/boards — 내가 소유하거나 멤버인 보드 + 공개 보드
export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // 내가 멤버인 보드 ID 목록
  const memberBoards = await prisma.boardMember.findMany({
    where: { userId },
    select: { boardId: true },
  })
  const memberBoardIds = new Set(memberBoards.map((m) => m.boardId))

  const boards = await prisma.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { isPublic: true },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { members: true, elements: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const myIds = boards
    .filter((b) => b.ownerId === userId || memberBoardIds.has(b.id))
    .map((b) => b.id)

  return NextResponse.json({ boards, myBoardIds: myIds })
}

// POST /api/boards — 보드 생성
export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, isPublic } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '보드 이름을 입력해주세요' }, { status: 400 })

  const board = await prisma.board.create({
    data: {
      name: name.trim(),
      description: description?.trim() ?? '',
      isPublic: isPublic !== false,
      ownerId: session.user.id,
    },
    include: {
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { members: true, elements: true } },
    },
  })

  return NextResponse.json(board)
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { boardEmitter } from '@/lib/boardEvents'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cursorX, cursorY, panX, panY, zoom } = await req.json()
  const userId = session.user.id
  const boardId = params.id

  boardEmitter.updateCursor(boardId, userId, { cursorX, cursorY, panX, panY, zoom })
  boardEmitter.emit(`board:${boardId}`, { type: 'cursor', userId, cursorX, cursorY, panX, panY, zoom })

  return NextResponse.json({ ok: true })
}

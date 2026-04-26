import { NextRequest } from 'next/server'
import { getAuth } from '@/lib/auth'
import { boardEmitter, BoardSSEEvent } from '@/lib/boardEvents'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const boardId = params.id
  const userId  = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Register presence
      boardEmitter.addPresence(boardId, {
        userId,
        name: session.user.name ?? '익명',
        image: session.user.image,
      })

      // Send current presence to this newcomer
      const presence = boardEmitter.getPresence(boardId)
      const initEvent: BoardSSEEvent = { type: 'presence', users: presence }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`))

      // Announce join to others
      const user = boardEmitter.getUser(boardId, userId)!
      const joinEvent: BoardSSEEvent = { type: 'join', user }
      boardEmitter.emit(`board:${boardId}`, joinEvent)

      // Listen for board events
      function onEvent(event: BoardSSEEvent) {
        // Don't echo cursor back to sender
        if (event.type === 'cursor' && event.userId === userId) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          boardEmitter.off(`board:${boardId}`, onEvent)
        }
      }
      boardEmitter.on(`board:${boardId}`, onEvent)

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')) }
        catch { clearInterval(heartbeat) }
      }, 25000)

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        boardEmitter.off(`board:${boardId}`, onEvent)
        boardEmitter.removePresence(boardId, userId)
        boardEmitter.emit(`board:${boardId}`, { type: 'leave', userId } as BoardSSEEvent)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
    },
  })
}

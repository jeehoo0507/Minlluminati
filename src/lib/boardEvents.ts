import { EventEmitter } from 'events'

export interface PresenceUser {
  userId: string
  name: string
  image?: string | null
  color: string
  cursorX?: number
  cursorY?: number
  panX?: number
  panY?: number
  zoom?: number
}

export type BoardSSEEvent =
  | { type: 'presence'; users: Record<string, PresenceUser> }
  | { type: 'join';     user: PresenceUser }
  | { type: 'leave';    userId: string }
  | { type: 'cursor';   userId: string; cursorX: number; cursorY: number; panX: number; panY: number; zoom: number }
  | { type: 'elements'; userId: string; elements: unknown[] }

// User colors — deterministic by index in presence list
export const PRESENCE_COLORS = [
  '#3b82f6', '#10b981', '#ef4444', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

class BoardEventEmitter extends EventEmitter {
  // boardId → Map<userId, PresenceUser>
  private presence = new Map<string, Map<string, PresenceUser>>()
  private colorIndex = new Map<string, Map<string, number>>() // boardId → userId → colorIndex

  addPresence(boardId: string, user: Omit<PresenceUser, 'color'>) {
    if (!this.presence.has(boardId)) {
      this.presence.set(boardId, new Map())
      this.colorIndex.set(boardId, new Map())
    }
    const board = this.presence.get(boardId)!
    const colors = this.colorIndex.get(boardId)!
    if (!colors.has(user.userId)) {
      colors.set(user.userId, colors.size % PRESENCE_COLORS.length)
    }
    const color = PRESENCE_COLORS[colors.get(user.userId)!]
    board.set(user.userId, { ...user, color })
  }

  removePresence(boardId: string, userId: string) {
    this.presence.get(boardId)?.delete(userId)
  }

  updateCursor(boardId: string, userId: string, data: { cursorX: number; cursorY: number; panX: number; panY: number; zoom: number }) {
    const u = this.presence.get(boardId)?.get(userId)
    if (u) Object.assign(u, data)
  }

  getPresence(boardId: string): Record<string, PresenceUser> {
    const result: Record<string, PresenceUser> = {}
    this.presence.get(boardId)?.forEach((u, id) => { result[id] = u })
    return result
  }

  getUser(boardId: string, userId: string): PresenceUser | undefined {
    return this.presence.get(boardId)?.get(userId)
  }
}

declare global { var _boardEmitter: BoardEventEmitter | undefined }
export const boardEmitter: BoardEventEmitter = globalThis._boardEmitter ?? (globalThis._boardEmitter = new BoardEventEmitter())
boardEmitter.setMaxListeners(500)

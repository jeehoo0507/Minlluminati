'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ArrowLeft, Send, ImageIcon, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  content: string
  imageUrl?: string | null
  deletedAt?: string | null
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
}

export default function GroupChatPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  // long-press for mobile delete
  const [longPressId, setLongPressId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTimestampRef = useRef<string | null>(null)
  const isPollingRef = useRef(false)
  const imageRef = useRef<HTMLInputElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialScrollDone = useRef(false)

  async function loadInitial() {
    const [msgRes, groupRes] = await Promise.all([
      fetch(`/api/groups/${id}/messages`),
      fetch(`/api/groups/${id}`),
    ])
    if (msgRes.ok) {
      const msgs: Message[] = await msgRes.json()
      setMessages(msgs)
      if (msgs.length > 0) lastTimestampRef.current = msgs[msgs.length - 1].createdAt
    }
    if (groupRes.ok) {
      const g = await groupRes.json()
      setIsMember(!!g.myMembership)
    }
    setLoading(false)
  }

  async function poll() {
    if (isPollingRef.current) return
    const after = lastTimestampRef.current
    if (!after) return
    isPollingRef.current = true
    try {
      const res = await fetch(`/api/groups/${id}/messages?after=${encodeURIComponent(after)}`)
      if (!res.ok) return
      const newMsgs: Message[] = await res.json()
      if (newMsgs.length > 0) {
        lastTimestampRef.current = newMsgs[newMsgs.length - 1].createdAt
        setMessages((prev) => [...prev, ...newMsgs])
      }
    } finally {
      isPollingRef.current = false
    }
  }

  useEffect(() => { loadInitial() }, [id, session])
  useEffect(() => {
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [id])

  // 첫 로드: 즉시 스크롤 / 이후 새 메시지: 부드러운 스크롤
  useEffect(() => {
    if (messages.length === 0) return
    if (!initialScrollDone.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      initialScrollDone.current = true
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function canDelete(msg: Message) {
    return msg.author.id === session?.user?.id || session?.user?.role === 'ADMIN'
  }

  function startLongPress(msgId: string) {
    longPressTimer.current = setTimeout(() => setLongPressId(msgId), 500)
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  async function handleSend() {
    if (!input.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/groups/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      })
      if (res.ok) {
        const msg: Message = await res.json()
        setInput('')
        setMessages((prev) => [...prev, msg])
        lastTimestampRef.current = msg.createdAt
      } else {
        toast.error((await res.json()).error ?? '전송 실패')
      }
    } finally { setSending(false) }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) { toast.error('업로드 실패'); return }
      const { url } = await up.json()
      const res = await fetch(`/api/groups/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', imageUrl: url }),
      })
      if (res.ok) {
        const msg: Message = await res.json()
        setMessages((prev) => [...prev, msg])
        lastTimestampRef.current = msg.createdAt
      }
    } finally {
      setImgUploading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function deleteMessage(msgId: string) {
    setLongPressId(null)
    const res = await fetch(`/api/groups/${id}/messages/${msgId}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.map((m) =>
        m.id === msgId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m
      ))
    } else toast.error('삭제 실패')
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  // #숫자 → /post/숫자 링크, URL → 클릭 가능한 링크
  function renderContent(text: string) {
    const parts = text.split(/(#\d+|https?:\/\/[^\s]+)/)
    return parts.map((part, i) => {
      if (/^#(\d+)$/.test(part)) {
        const num = part.slice(1)
        return (
          <Link key={i} href={`/post/${num}`} className="underline font-medium hover:opacity-80">
            {part}
          </Link>
        )
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:opacity-80 break-all">
            {part}
          </a>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href={`/groups/${id}`} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> 그룹으로
        </Link>
        <span className="text-sm font-semibold text-text-primary">채팅</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-2xl p-4 space-y-3 min-h-0">
        {/* 로딩 스켈레톤 */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-surface-2 animate-pulse shrink-0" />
                <div className={`h-9 rounded-2xl bg-surface-2 animate-pulse ${i % 2 === 0 ? 'w-40' : 'w-56'}`} />
              </div>
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-16 text-text-secondary text-sm">아직 메시지가 없습니다</div>
        )}

        {!loading && messages.map((m) => {
          const isMe = m.author.id === session?.user?.id
          const deleted = !!m.deletedAt
          const deletable = !deleted && canDelete(m)
          const isLongPressed = longPressId === m.id

          return (
            <div
              key={m.id}
              className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''}`}
              // 모바일 꾹누르기
              onTouchStart={() => deletable ? startLongPress(m.id) : undefined}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
            >
              <Avatar name={m.author.name} image={m.author.image} size={28} />
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-secondary font-medium">{m.author.name}</span>
                    <TierBadge points={m.author.points} />
                  </div>
                )}
                {deleted ? (
                  <div className="px-3 py-2 rounded-2xl text-sm text-muted italic bg-surface-2 border border-border border-dashed">
                    삭제된 메시지입니다
                  </div>
                ) : (
                  <>
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="image" className="max-w-full rounded-xl max-h-64 object-contain border border-border" />
                    )}
                    {m.content && (
                      <div className={`px-3 py-2 rounded-2xl text-sm break-words ${isMe ? 'bg-accent text-white rounded-tr-sm' : 'bg-surface-2 text-text-primary rounded-tl-sm'}`}>
                        {renderContent(m.content)}
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{formatTime(m.createdAt)}</span>
                  {/* 데스크탑: hover 시 휴지통 버튼 */}
                  {deletable && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 touch-none"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                {/* 모바일: 꾹누르기 후 삭제 버튼 표시 */}
                {isLongPressed && deletable && (
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold"
                    >
                      <Trash2 size={11} /> 삭제
                    </button>
                    <button
                      onClick={() => setLongPressId(null)}
                      className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-xs text-text-secondary"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {isMember ? (
        <div className="mt-3 flex gap-2 shrink-0 items-end">
          <button
            onClick={() => imageRef.current?.click()}
            disabled={imgUploading}
            className="p-2.5 rounded-xl border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50"
            title="이미지 전송"
          >
            <ImageIcon size={16} />
          </button>
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="메시지 입력 (Enter 전송) · #번호로 게시글 링크"
            className="flex-1 bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-3 py-2.5 rounded-xl bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      ) : (
        <div className="mt-3 text-center text-sm text-text-secondary py-3 bg-surface border border-border rounded-xl">
          채팅에 참여하려면 그룹에 가입하세요
        </div>
      )}
    </div>
  )
}

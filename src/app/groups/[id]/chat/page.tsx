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
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTimestampRef = useRef<string | null>(null)
  const isPollingRef = useRef(false)
  const imageRef = useRef<HTMLInputElement>(null)

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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

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
    const res = await fetch(`/api/groups/${id}/messages/${msgId}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m))
    } else toast.error('삭제 실패')
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  function renderContent(text: string) {
    const parts = text.split(/(#\d+)/)
    return parts.map((part, i) => {
      const match = part.match(/^#(\d+)$/)
      if (match) {
        return (
          <Link key={i} href={`/problems/${match[1]}`} className="underline font-medium hover:opacity-80">
            {part}
          </Link>
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
        {messages.length === 0 && (
          <div className="text-center py-16 text-text-secondary text-sm">아직 메시지가 없습니다</div>
        )}
        {messages.map((m) => {
          const isMe = m.author.id === session?.user?.id
          const isAdmin = session?.user?.role === 'ADMIN'
          const deleted = !!m.deletedAt
          return (
            <div key={m.id} className={`flex gap-2 group ${isMe ? 'flex-row-reverse' : ''}`}>
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
                  {!deleted && (isMe || isAdmin) && (
                    <button onClick={() => deleteMessage(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
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
            placeholder="메시지를 입력하세요 (Enter 전송)"
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

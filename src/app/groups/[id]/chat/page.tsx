'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ArrowLeft, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  content: string
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTimestampRef = useRef<string | null>(null)

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
    const after = lastTimestampRef.current
    const url = after
      ? `/api/groups/${id}/messages?after=${encodeURIComponent(after)}`
      : `/api/groups/${id}/messages`
    const res = await fetch(url)
    if (!res.ok) return
    const newMsgs: Message[] = await res.json()
    if (newMsgs.length > 0) {
      lastTimestampRef.current = newMsgs[newMsgs.length - 1].createdAt
      setMessages((prev) => [...prev, ...newMsgs])
    }
  }

  useEffect(() => {
    loadInitial()
  }, [id, session])

  useEffect(() => {
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        setInput('')
        await poll()
      } else {
        toast.error((await res.json()).error ?? '전송 실패')
      }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <Avatar name={m.author.name} image={m.author.image} size={28} />
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-secondary font-medium">{m.author.name}</span>
                    <TierBadge points={m.author.points} />
                  </div>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm break-words ${isMe ? 'bg-accent text-white rounded-tr-sm' : 'bg-surface-2 text-text-primary rounded-tl-sm'}`}>
                  {m.content}
                </div>
                <span className="text-xs text-muted">{formatTime(m.createdAt)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {isMember ? (
        <div className="mt-3 flex gap-2 shrink-0">
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

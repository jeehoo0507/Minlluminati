'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Send, ImagePlus, X, Trash2, Sparkles, Lock, Bot, BotOff, User,
  Loader2, AlertCircle, Plus, MessageSquare, Pencil, Check,
  Menu, Search, BookOpen, Newspaper,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  imageUrls?: string[]
  createdAt?: string
  streaming?: boolean
}

interface AiSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  _count: { messages: number }
}

interface AiStatus {
  subscribed: boolean
  expiresAt: string | null
  shopPoints: number
  aiDisabled?: boolean
}

export default function AiPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [sessions, setSessions] = useState<AiSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [buying, setBuying] = useState(false)
  const [searchTarget, setSearchTarget] = useState<'problem' | 'post' | false>(false)
  const [error, setError] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/ai/status')
    if (res.ok) setAiStatus(await res.json())
  }, [])

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    const res = await fetch('/api/ai/sessions')
    if (res.ok) {
      const data: AiSession[] = await res.json()
      setSessions(data)
      // 첫 로드 시 가장 최근 세션 자동 선택
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id)
      }
    }
    setLoadingSessions(false)
  }, [activeSessionId])

  useEffect(() => {
    if (session?.user) loadStatus()
  }, [session, loadStatus])

  useEffect(() => {
    if (aiStatus?.subscribed) loadSessions()
    else setLoadingSessions(false)
  }, [aiStatus]) // eslint-disable-line

  // 세션 변경 시 메시지 로드
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return }
    setLoadingHistory(true)
    fetch(`/api/ai/history?sessionId=${activeSessionId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMessages(data))
      .finally(() => setLoadingHistory(false))
  }, [activeSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => setImages((prev) => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  async function handleBuy() {
    setBuying(true); setError('')
    try {
      const res = await fetch('/api/ai/subscribe', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      await loadStatus()
    } finally { setBuying(false) }
  }

  async function createNewSession() {
    const res = await fetch('/api/ai/sessions', { method: 'POST' })
    if (res.ok) {
      const s: AiSession = await res.json()
      setSessions((prev) => [{ ...s, _count: { messages: 0 } }, ...prev])
      setActiveSessionId(s.id)
      setMessages([])
      setSidebarOpen(false) // 모바일에서 자동 닫기
    }
  }

  async function deleteSession(id: string) {
    const res = await fetch(`/api/ai/sessions/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('삭제에 실패했습니다')
      return
    }
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id)
      setActiveSessionId(remaining[0]?.id ?? null)
    }
    toast.success('대화가 삭제되었습니다')
  }

  async function saveTitle(id: string) {
    if (!editTitle.trim()) { setEditingId(null); return }
    const res = await fetch(`/api/ai/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle }),
    })
    if (res.ok) {
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: editTitle.trim() } : s))
    }
    setEditingId(null)
  }

  async function handleClearMessages() {
    if (!activeSessionId) return
    const res = await fetch(`/api/ai/history?sessionId=${activeSessionId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('메시지 삭제에 실패했습니다')
      return
    }
    setMessages([])
    setSessions((prev) =>
      prev.map((s) => s.id === activeSessionId ? { ...s, _count: { messages: 0 } } : s)
    )
    toast.success('메시지가 삭제되었습니다')
  }

  async function handleSend() {
    if (sending || !activeSessionId) return
    const text = input.trim()
    if (!text && images.length === 0) return

    const pendingImages = [...images]
    const pendingSearchTarget = searchTarget
    const streamId = `stream-${Date.now()}`
    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: text, imageUrls: pendingImages }
    const assistantPlaceholder: Message = { id: streamId, role: 'assistant', content: '', streaming: true }

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
    setInput('')
    setImages([])
    setSearchTarget(false)
    setSending(true)
    setError('')

    // textarea 높이 리셋
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, images: pendingImages, sessionId: activeSessionId, searchTarget: pendingSearchTarget }),
      })

      if (!res.ok) {
        const d = await res.json()
        setMessages((prev) => prev.filter((m) => m.id !== streamId && m.id !== userMsg.id))
        setError(d.error ?? 'AI 오류가 발생했습니다')
        return
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let accum = ''
      let isFirst = messages.length === 0 // 첫 메시지면 세션 목록 타이틀 갱신 필요

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.searchEmpty) {
              toast('플랫폼 DB에 일치하는 자료가 없습니다. AI가 일반 지식으로 답변합니다.', {
                duration: 3500,
              })
            }
            if (payload.token) {
              accum += payload.token
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, content: accum, streaming: true } : m)
              )
            }
            if (payload.done) {
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, content: accum, streaming: false } : m)
              )
              // 첫 메시지였으면 세션 목록 새로고침 (타이틀 자동 갱신)
              if (isFirst) await loadSessions()
            }
            if (payload.error) {
              setError(payload.error)
              setMessages((prev) => prev.filter((m) => m.id !== streamId))
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
      setMessages((prev) => prev.filter((m) => m.id !== streamId && m.id !== userMsg.id))
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  function selectSession(id: string) {
    setActiveSessionId(id)
    setError('')
    setSidebarOpen(false) // 모바일에서 자동 닫기
  }

  // ── 로딩 ──────────────────────────────────────────────────────────
  if (status === 'loading' || !aiStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    )
  }

  // ── 관리자 비활성화 화면 ──────────────────────────────────────────
  if (aiStatus.aiDisabled) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 mb-6">
          <BotOff size={36} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">AI 기능 비활성화</h1>
        <p className="text-text-secondary text-sm">관리자에 의해 AI 기능이 비활성화되었습니다.</p>
        <p className="text-text-secondary text-sm mt-1">문의가 필요하면 관리자에게 연락하세요.</p>
      </div>
    )
  }

  // ── 구독 잠금 화면 ─────────────────────────────────────────────────
  if (!aiStatus.subscribed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-6">
          <Sparkles size={36} className="text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">AI 튜터</h1>
        <p className="text-text-secondary mb-1 text-sm">수학·과학 학습을 돕는 AI 튜터입니다</p>
        <p className="text-text-secondary mb-8 text-sm">이미지 첨부, LaTeX 수식, 멀티 세션 지원</p>

        <div className="bg-surface border border-border rounded-2xl p-6 mb-6 text-left space-y-3">
          {[
            '수학·과학 개념 설명 및 풀이 도움',
            '이미지 첨부 — 문제 사진 분석 지원',
            'LaTeX 수식 렌더링',
            '여러 대화 세션 독립 관리',
          ].map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">✓</span>
              {t}
            </div>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-text-secondary">이용권</span>
            <span className="text-lg font-bold text-accent">1,000 SP / 30일</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">보유 상점 포인트</span>
            <span className={`font-semibold ${aiStatus.shopPoints >= 1000 ? 'text-text-primary' : 'text-red-400'}`}>
              {aiStatus.shopPoints.toLocaleString()} SP
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-500/10 rounded-xl px-4 py-3">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {aiStatus.shopPoints < 1000 ? (
          <div className="flex items-center gap-2 justify-center text-text-secondary text-sm bg-surface border border-border rounded-xl p-4">
            <Lock size={14} /> 상점 포인트가 부족합니다. 문제를 풀어 포인트를 모아보세요!
          </div>
        ) : (
          <button
            onClick={handleBuy}
            disabled={buying}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent text-background font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {buying ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {buying ? '처리 중...' : '1,000 SP로 30일 이용권 구매'}
          </button>
        )}
      </div>
    )
  }

  // ── 채팅 UI ───────────────────────────────────────────────────────
  const daysLeft = aiStatus.expiresAt
    ? Math.ceil((new Date(aiStatus.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── 세션 사이드바 ─────────────────────────────────────────── */}
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        flex flex-col bg-surface border-r border-border w-64 shrink-0 z-40
        transition-transform duration-200
        fixed md:relative inset-y-0 left-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:top-auto
        top-14
      `} style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* 새 대화 버튼 */}
        <div className="p-3 border-b border-border shrink-0">
          <button
            onClick={createNewSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
          >
            <Plus size={15} /> 새 대화
          </button>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingSessions ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-accent" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-xs px-4">
              새 대화 버튼을 눌러<br />첫 번째 대화를 시작하세요
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                  activeSessionId === s.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`}
                onClick={() => selectSession(s.id)}
              >
                <MessageSquare size={13} className="shrink-0" />

                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle(s.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-xs bg-transparent border-b border-accent outline-none text-text-primary min-w-0"
                  />
                ) : (
                  <span className="flex-1 text-xs truncate min-w-0">{s.title}</span>
                )}

                {/* 편집/삭제 버튼 */}
                <div
                  className={`flex items-center gap-1 shrink-0 ${editingId === s.id ? 'flex' : 'hidden group-hover:flex'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingId === s.id ? (
                    <button
                      onClick={() => saveTitle(s.id)}
                      className="p-0.5 rounded hover:text-green-400 transition-colors"
                    >
                      <Check size={12} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditingId(s.id); setEditTitle(s.title) }}
                      className="p-0.5 rounded hover:text-accent transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="p-0.5 rounded hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 하단 구독 정보 */}
        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <div className="text-xs text-text-secondary flex items-center justify-between">
            <span>잔여 <span className="text-text-primary font-semibold">{daysLeft}일</span></span>
            <button
              onClick={handleBuy}
              disabled={buying}
              className="text-accent hover:underline text-xs"
            >
              {buying ? '처리 중…' : '+30일 연장'}
            </button>
          </div>
        </div>
      </aside>

      {/* ── 채팅 영역 ──────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* 헤더 */}
        <div className="border-b border-border bg-background/80 backdrop-blur-md px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* 모바일 사이드바 토글 */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-2 transition-colors text-text-secondary"
            >
              <Menu size={16} />
            </button>
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles size={13} className="text-accent" />
            </div>
            <span className="text-sm font-semibold text-text-primary truncate max-w-[200px]">
              {activeSession?.title ?? 'AI 튜터'}
            </span>
          </div>
          {activeSessionId && messages.length > 0 && (
            <button
              onClick={handleClearMessages}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-surface-2"
            >
              <Trash2 size={12} /> 메시지 삭제
            </button>
          )}
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {!activeSessionId ? (
            /* 세션 없을 때 */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Bot size={28} className="text-accent" />
              </div>
              <p className="text-text-primary font-semibold mb-1">AI 튜터에 오신 것을 환영합니다</p>
              <p className="text-text-secondary text-sm mb-6">왼쪽에서 대화를 선택하거나 새 대화를 시작하세요</p>
              <button
                onClick={createNewSession}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
              >
                <Plus size={15} /> 새 대화 시작
              </button>
            </div>
          ) : loadingHistory ? (
            <div className="flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Bot size={24} className="text-accent" />
              </div>
              <p className="text-text-primary font-semibold mb-1">무엇이든 물어보세요</p>
              <p className="text-text-secondary text-sm mb-6">수학·과학 개념, 문제 풀이, 이미지 분석</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
                {[
                  '행렬의 역행렬을 구하는 방법을 알려주세요',
                  '미분과 적분의 차이가 뭔가요?',
                  '뉴턴의 운동 법칙 3가지를 설명해주세요',
                  '이 문제 풀이를 단계별로 설명해줘',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left text-xs text-text-secondary bg-surface border border-border hover:border-accent/40 hover:text-text-primary rounded-xl px-3 py-2.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id ?? i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === 'user' ? 'bg-accent text-background' : 'bg-surface-2 border border-border'
                }`}>
                  {msg.role === 'user' ? <User size={13} /> : <Sparkles size={13} className="text-accent" />}
                </div>

                <div className={`max-w-[80%] space-y-2 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {(msg.imageUrls ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(msg.imageUrls ?? []).map((url, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={url} alt="첨부" className="max-w-[180px] max-h-[180px] rounded-xl object-cover border border-border" />
                      ))}
                    </div>
                  )}
                  {(msg.content || msg.streaming) && (
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-accent text-background rounded-tr-sm'
                        : 'bg-surface border border-border text-text-primary rounded-tl-sm'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <>
                          <div className="ai-markdown text-sm leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                a: ({ href, children }) => {
                                  // 내부 링크(/problems/..., /post/...) → Next.js Link
                                  if (href?.startsWith('/')) {
                                    return (
                                      <Link
                                        href={href}
                                        className="text-accent underline underline-offset-2 hover:text-accent-dim"
                                        target="_blank"
                                      >
                                        {children}
                                      </Link>
                                    )
                                  }
                                  return <a href={href} className="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>
                                },
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                          {msg.streaming && (
                            <span className="inline-block w-1 h-4 bg-accent animate-pulse ml-0.5 align-middle" />
                          )}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mx-2">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 영역 */}
        {activeSessionId && (
          <div className="border-t border-border bg-background/80 backdrop-blur-md px-4 py-3 shrink-0">
            {images.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X size={9} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* 검색 모드 배너 */}
            {searchTarget !== false && (
              <div className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-1.5 mb-2">
                {searchTarget === 'problem' ? <BookOpen size={11} /> : <Newspaper size={11} />}
                <span>
                  {searchTarget === 'problem' ? '문제 검색 모드' : '피드 검색 모드'}
                  {' — 전송 시 양현재+ DB에서 관련 '}
                  {searchTarget === 'problem' ? '문제' : '피드 글'}
                  을 검색합니다
                </span>
                <button onClick={() => setSearchTarget(false)} className="ml-auto hover:text-red-400 transition-colors">
                  <X size={11} />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleImageAdd} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors mb-0.5"
                title="이미지 첨부"
              >
                <ImagePlus size={15} />
              </button>
              {/* 문제 검색 토글 */}
              <button
                onClick={() => setSearchTarget((v) => v === 'problem' ? false : 'problem')}
                title="문제에서 찾기"
                className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-colors mb-0.5 ${
                  searchTarget === 'problem'
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'border-border text-text-secondary hover:text-accent hover:border-accent/40'
                }`}
              >
                <BookOpen size={15} />
              </button>
              {/* 피드 검색 토글 */}
              <button
                onClick={() => setSearchTarget((v) => v === 'post' ? false : 'post')}
                title="피드에서 찾기"
                className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-colors mb-0.5 ${
                  searchTarget === 'post'
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'border-border text-text-secondary hover:text-accent hover:border-accent/40'
                }`}
              >
                <Newspaper size={15} />
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    searchTarget === 'problem' ? '문제 검색어를 입력하세요… (예: 미분, 행렬)' :
                    searchTarget === 'post' ? '피드 검색어를 입력하세요… (예: 미분, 역학)' :
                    '수학·과학 질문을 입력하세요… (Shift+Enter 줄바꿈)'
                  }
                  rows={1}
                  className={`w-full resize-none rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none transition-colors ${
                    searchTarget !== false ? 'border-accent/40 focus:border-accent' : 'border-border focus:border-accent/50'
                  }`}
                  style={{ minHeight: '42px', maxHeight: '160px' }}
                  disabled={sending}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={sending || (!input.trim() && images.length === 0)}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-accent text-background hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-muted mt-1.5 text-center">
              AI는 실수할 수 있습니다. 중요한 내용은 직접 확인하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

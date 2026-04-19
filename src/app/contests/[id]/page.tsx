'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { Clock, Users, CheckCircle, Play, Pencil, X, Save, Send, MessageSquare, Plus, ImagePlus, RefreshCw, Ban, UserPlus, Eye, PenLine } from 'lucide-react'
import toast from 'react-hot-toast'

interface Problem { id: string; label: string; title: string; content: string; answer?: string; extraAnswers?: string[]; points: number; imageUrls?: string[]; allowRetry?: boolean }
interface Contributor { id: string; userId: string; role: string; user: { id: string; name?: string | null; image?: string | null; points: number } }
interface ChatMsg { id: string; content: string; createdAt: string; author: { id: string; name?: string | null; image?: string | null } }
interface Contest {
  id: string; title: string; description: string; rules: string; status: string
  startTime: string | null; durationMin: number; organizerId: string
  organizer: { id: string; name?: string | null; image?: string | null; points: number }
  contributors: Contributor[]
  problems: Problem[]; _count: { participants: number }
  myParticipant: { id: string } | null
  mySubmissions: Record<string, boolean>
}

export default function ContestPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [contest, setContest] = useState<Contest | null>(null)
  const [leaderboard, setLeaderboard] = useState<{ rank: number; user: { id: string; name?: string | null; image?: string | null; points: number }; score: number; solvedProblems: { problem: { label: string; title: string } }[] }[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'problems' | 'leaderboard' | 'info' | 'chat'>('problems')
  const [editingProblem, setEditingProblem] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Problem>>({})
  const [saving, setSaving] = useState(false)
  const [chats, setChats] = useState<ChatMsg[]>([])
  const [chatMsg, setChatMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [uploadingProblem, setUploadingProblem] = useState<string | null>(null)
  const [editPreview, setEditPreview] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoDraft, setInfoDraft] = useState({ title: '', description: '', rules: '', contribs: [] as { query: string; role: 'CONTRIBUTOR' | 'REVIEWER' }[] })
  const [savingInfo, setSavingInfo] = useState(false)
  const [newContribQuery, setNewContribQuery] = useState('')
  const [newContribRole, setNewContribRole] = useState<'CONTRIBUTOR' | 'REVIEWER'>('CONTRIBUTOR')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/contests/${id}`)
    if (res.ok) setContest(await res.json())
    setLoading(false)
  }, [id])

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch(`/api/contests/${id}/leaderboard`)
    if (res.ok) setLeaderboard(await res.json())
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (contest?.status === 'ENDED') loadLeaderboard()
  }, [contest?.status, loadLeaderboard])

  // Timer
  useEffect(() => {
    if (!contest?.startTime || contest.status !== 'ONGOING') { setTimeLeft(null); return }
    const end = new Date(contest.startTime).getTime() + contest.durationMin * 60 * 1000
    const tick = () => {
      const left = Math.max(0, end - Date.now())
      setTimeLeft(left)
      if (left === 0) load()
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [contest?.startTime, contest?.status, contest?.durationMin, load])

  async function handleJoin() {
    const res = await fetch(`/api/contests/${id}/join`, { method: 'POST' })
    if (res.ok) { toast.success('대회에 참가했습니다'); load() }
    else toast.error((await res.json()).error ?? '오류')
  }

  async function handleLeave() {
    await fetch(`/api/contests/${id}/join`, { method: 'DELETE' })
    load()
  }

  async function handleStart() {
    const res = await fetch(`/api/contests/${id}/start`, { method: 'POST' })
    if (res.ok) { toast.success('대회가 시작되었습니다'); load() }
    else toast.error((await res.json()).error)
  }

  async function handleSubmit(problemId: string) {
    const answer = answers[problemId]?.trim()
    if (!answer) { toast.error('답을 입력해주세요'); return }
    setSubmitting(problemId)
    try {
      const res = await fetch(`/api/contests/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, answer }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      if (data.correct) {
        toast.success('정답입니다!')
        setContest((c) => c ? { ...c, mySubmissions: { ...c.mySubmissions, [problemId]: true } } : c)
      } else {
        toast.error('오답입니다. 다시 시도해보세요')
      }
    } finally { setSubmitting(null) }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="h-64 bg-surface border border-border rounded-xl animate-pulse" /></div>
  if (!contest) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-text-secondary">대회를 찾을 수 없습니다</div>

  const isOrganizer = session?.user?.id === contest.organizerId
  const isAdmin = session?.user?.role === 'ADMIN'
  const isContributor = session?.user
    ? contest.contributors.some((c) => c.user.id === session.user!.id)
    : false
  const isParticipant = !!contest.myParticipant
  const canStart = (isOrganizer || isAdmin) && contest.status === 'APPROVED'
  const canEditProblems = (isOrganizer || isAdmin || isContributor) && !['ONGOING', 'ENDED'].includes(contest.status)
  const canChat = (isOrganizer || isAdmin || isContributor) && !['ONGOING', 'ENDED'].includes(contest.status)

  async function saveInfo() {
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/contests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: infoDraft.title,
          description: infoDraft.description,
          rules: infoDraft.rules,
          contributors: infoDraft.contribs,
        }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      toast.success('대회 정보가 수정되었습니다')
      setEditingInfo(false)
      load()
    } finally { setSavingInfo(false) }
  }

  async function saveProblemEdit(problemId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contests/${id}/problems/${problemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      toast.success('문제가 수정되었습니다')
      setEditingProblem(null)
      load()
    } finally { setSaving(false) }
  }

  async function loadChat() {
    const res = await fetch(`/api/contests/${id}/chat`)
    if (res.ok) setChats(await res.json())
  }

  async function sendChat() {
    if (!chatMsg.trim()) return
    setChatLoading(true)
    try {
      const res = await fetch(`/api/contests/${id}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatMsg.trim() }),
      })
      if (res.ok) { setChatMsg(''); loadChat() }
      else toast.error((await res.json()).error ?? '오류')
    } finally { setChatLoading(false) }
  }

  function insertEditImageAtCursor(url: string) {
    const insert = `![이미지](${url})`
    const ta = editTextareaRef.current
    const start = ta?.selectionStart ?? null
    const end = ta?.selectionEnd ?? null
    setEditDraft((d) => {
      const content = d.content ?? ''
      const s = start ?? content.length
      const e = end ?? content.length
      return { ...d, content: content.slice(0, s) + insert + content.slice(e), imageUrls: [...(d.imageUrls ?? []), url] }
    })
    if (ta && start !== null) {
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length
        ta.focus()
      })
    }
  }

  async function uploadProblemImage(problemId: string, file: File) {
    setUploadingProblem(problemId)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const { url } = await res.json()
      const problem = contest?.problems.find((p) => p.id === problemId)
      const currentUrls = problem?.imageUrls ?? []
      const patchRes = await fetch(`/api/contests/${id}/problems/${problemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: [...currentUrls, url] }),
      })
      if (patchRes.ok) { toast.success('이미지 업로드 완료'); load() }
    } finally { setUploadingProblem(null) }
  }

  const formatTime = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }

  const STATUS_COLORS: Record<string, string> = {
    APPROVED: 'text-green-700 bg-green-50 border-green-200',
    ONGOING:  'text-blue-700 bg-blue-50 border-blue-200',
    ENDED:    'text-gray-500 bg-gray-100 border-gray-200',
    PENDING:  'text-amber-700 bg-amber-50 border-amber-200',
    DRAFT:    'text-gray-400 bg-gray-50 border-gray-200',
  }
  const STATUS_TEXT: Record<string, string> = { APPROVED: '참가 신청', ONGOING: '진행 중', ENDED: '종료', PENDING: '검토 중', DRAFT: '초안' }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        {editingInfo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-text-primary">대회 정보 수정</span>
              <button onClick={() => setEditingInfo(false)} className="text-muted hover:text-text-secondary"><X size={16} /></button>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">대회명</label>
              <input value={infoDraft.title} onChange={(e) => setInfoDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">설명</label>
              <textarea value={infoDraft.description} onChange={(e) => setInfoDraft((d) => ({ ...d, description: e.target.value }))} rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">규칙</label>
              <textarea value={infoDraft.rules} onChange={(e) => setInfoDraft((d) => ({ ...d, rules: e.target.value }))} rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted mb-2 block">출제자 / 검토자</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {infoDraft.contribs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-xs text-text-secondary">
                    <span className="text-accent font-medium">{c.role === 'CONTRIBUTOR' ? '출제' : '검토'}</span>
                    {c.query}
                    <button onClick={() => setInfoDraft((d) => ({ ...d, contribs: d.contribs.filter((_, k) => k !== i) }))} className="text-muted hover:text-red-400"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newContribQuery}
                  onChange={(e) => setNewContribQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newContribQuery.trim()) {
                      setInfoDraft((d) => ({ ...d, contribs: [...d.contribs, { query: newContribQuery.trim(), role: newContribRole }] }))
                      setNewContribQuery('')
                    }
                  }}
                  placeholder="이메일 또는 닉네임"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <select value={newContribRole} onChange={(e) => setNewContribRole(e.target.value as 'CONTRIBUTOR' | 'REVIEWER')}
                  className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="CONTRIBUTOR">출제자</option>
                  <option value="REVIEWER">검토자</option>
                </select>
                <button type="button" onClick={() => {
                  if (!newContribQuery.trim()) return
                  setInfoDraft((d) => ({ ...d, contribs: [...d.contribs, { query: newContribQuery.trim(), role: newContribRole }] }))
                  setNewContribQuery('')
                }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors">
                  <UserPlus size={12} /> 추가
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => setEditingInfo(false)} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface-2 transition-colors">취소</button>
              <button onClick={saveInfo} disabled={savingInfo}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                <Save size={13} />{savingInfo ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[contest.status] ?? ''}`}>
                    {STATUS_TEXT[contest.status]}
                  </span>
                  {contest.status === 'ONGOING' && timeLeft !== null && (
                    <span className={`text-sm font-mono font-bold ${timeLeft < 300000 ? 'text-red-500' : 'text-accent'}`}>
                      <Clock size={13} className="inline mr-1" />{formatTime(timeLeft)}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-text-primary">{contest.title}</h1>
                {contest.description && <p className="text-sm text-text-secondary mt-1">{contest.description}</p>}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted flex items-center gap-1"><Clock size={13} />{contest.durationMin}분</div>
                  <div className="text-sm text-muted flex items-center gap-1"><Users size={13} />{contest._count.participants}명</div>
                </div>
                {(isOrganizer || isAdmin) && !['ONGOING', 'ENDED'].includes(contest.status) && (
                  <button
                    onClick={() => {
                      setInfoDraft({
                        title: contest.title,
                        description: contest.description ?? '',
                        rules: contest.rules ?? '',
                        contribs: contest.contributors.map((c) => ({ query: c.user.name ?? '', role: c.role as 'CONTRIBUTOR' | 'REVIEWER' })),
                      })
                      setEditingInfo(true)
                    }}
                    className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
                  >
                    <Pencil size={12} /> 수정
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <Avatar name={contest.organizer.name} image={contest.organizer.image} size={20} />
                <span className="font-medium text-text-secondary">{contest.organizer.name}</span>
                <TierBadge points={contest.organizer.points} />
                <span className="text-muted">(주최)</span>
              </div>
              {['CONTRIBUTOR', 'REVIEWER'].map((role) => {
                const group = contest.contributors.filter((c) => c.role === role)
                if (!group.length) return null
                return (
                  <div key={role} className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-text-secondary">{role === 'CONTRIBUTOR' ? '출제' : '검토'}:</span>
                    {group.map((c) => (
                      <Link key={c.id} href={`/users/${c.userId}`} className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-2 rounded hover:bg-surface transition-colors">
                        <Avatar name={c.user.name} image={c.user.image} size={16} />
                        <span className="text-text-secondary text-xs">{c.user.name ?? '?'}</span>
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button onClick={handleStart}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              <Play size={14} /> 대회 시작
            </button>
          )}
          {['APPROVED', 'ONGOING'].includes(contest.status) && session?.user && !isOrganizer && (
            isParticipant ? (
              <button onClick={handleLeave}
                className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
                참가 취소
              </button>
            ) : (
              <button onClick={handleJoin}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
                참가하기
              </button>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit flex-wrap">
        {(['problems', 'leaderboard', 'info'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === 'leaderboard') loadLeaderboard() }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            {t === 'problems' ? '문제' : t === 'leaderboard' ? '순위표' : '정보'}
          </button>
        ))}
        {canChat && (
          <button onClick={() => { setTab('chat'); loadChat() }}
            className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'chat' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            <MessageSquare size={13} /> 사전 채팅
          </button>
        )}
      </div>

      {/* Problems */}
      {tab === 'problems' && (
        <div className="space-y-4">
          {contest.status === 'APPROVED' && !isParticipant && !isOrganizer && !isContributor && (
            <div className="p-4 bg-surface border border-border rounded-xl text-sm text-text-secondary text-center">
              대회 시작 후 참가자에게 문제가 공개됩니다
            </div>
          )}
          {(contest.status === 'ONGOING' || contest.status === 'ENDED' || isOrganizer || isAdmin || isContributor) && contest.problems.map((problem) => {
            const solved = contest.mySubmissions?.[problem.id]
            const isEditing = editingProblem === problem.id
            return (
              <div key={problem.id} className={`bg-surface border rounded-2xl p-5 space-y-4 ${solved ? 'border-green-300' : 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-accent w-8">{problem.label}</span>
                    <div>
                      <h3 className="font-semibold text-text-primary">{problem.title}</h3>
                      <span className="text-xs text-muted">{problem.points}점</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {solved && <CheckCircle size={20} className="text-green-500 shrink-0" />}
                    {canEditProblems && !isEditing && (
                      <button onClick={() => { setEditingProblem(problem.id); setEditDraft({ title: problem.title, content: problem.content, answer: problem.answer ?? '', extraAnswers: problem.extraAnswers ?? [], points: problem.points, label: problem.label, imageUrls: problem.imageUrls ?? [], allowRetry: problem.allowRetry !== false }) }}
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-text-secondary transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                    {isEditing && (
                      <button onClick={() => setEditingProblem(null)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="flex gap-2">
                      <div className="w-16">
                        <label className="text-xs text-muted mb-1 block">레이블</label>
                        <input value={editDraft.label ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted mb-1 block">제목</label>
                        <input value={editDraft.title ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                      </div>
                      <div className="w-20">
                        <label className="text-xs text-muted mb-1 block">점수</label>
                        <input type="number" value={editDraft.points ?? 100} onChange={(e) => setEditDraft((d) => ({ ...d, points: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted block">내용 (마크다운)</label>
                        <button type="button" onClick={() => setEditPreview((v) => !v)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${editPreview ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text-secondary'}`}>
                          {editPreview ? <><PenLine size={11} /> 편집</> : <><Eye size={11} /> 미리보기</>}
                        </button>
                      </div>
                      {editPreview ? (
                        <div className="w-full min-h-[144px] bg-background border border-border rounded-lg px-3 py-2 text-sm prose-content">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {editDraft.content || '*내용 없음*'}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <textarea
                          ref={editTextareaRef}
                          value={editDraft.content ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                          rows={6} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y font-mono" />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">정답</label>
                      <div className="space-y-2">
                        <input value={editDraft.answer ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, answer: e.target.value }))}
                          placeholder="정답 1 (필수)"
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                        {(editDraft.extraAnswers ?? []).map((ea, ei) => (
                          <div key={ei} className="flex gap-2">
                            <input value={ea}
                              onChange={(e) => { const next = [...(editDraft.extraAnswers ?? [])]; next[ei] = e.target.value; setEditDraft((d) => ({ ...d, extraAnswers: next })) }}
                              placeholder={`정답 ${ei + 2}`}
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                            <button type="button" onClick={() => setEditDraft((d) => ({ ...d, extraAnswers: (d.extraAnswers ?? []).filter((_, k) => k !== ei) }))} className="text-muted hover:text-red-400"><X size={12} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setEditDraft((d) => ({ ...d, extraAnswers: [...(d.extraAnswers ?? []), ''] }))} className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
                          <Plus size={11} /> 정답 추가
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">이미지</label>
                      <div className="flex gap-2 flex-wrap items-center">
                        {(editDraft.imageUrls ?? []).map((url, ui) => (
                          <div key={url} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-border" />
                            <button type="button" onClick={() => setEditDraft((d) => ({
                              ...d,
                              imageUrls: (d.imageUrls ?? []).filter((_, k) => k !== ui),
                              content: (d.content ?? '').replace(`![이미지](${url})`, ''),
                            }))}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => editFileInputRef.current?.click()} disabled={uploadingProblem === problem.id}
                          className="w-14 h-14 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50">
                          <ImagePlus size={13} /><span className="text-xs">{uploadingProblem === problem.id ? '...' : '추가'}</span>
                        </button>
                        <input ref={editFileInputRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) {
                              const fd = new FormData(); fd.append('file', f)
                              fetch('/api/upload', { method: 'POST', body: fd })
                                .then((r) => r.json())
                                .then((d) => insertEditImageAtCursor(d.url))
                              e.target.value = ''
                            }
                          }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setEditDraft((d) => ({ ...d, allowRetry: !d.allowRetry }))}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${editDraft.allowRetry !== false ? 'text-green-600 bg-green-50 border border-green-200' : 'text-red-500 bg-red-50 border border-red-200'}`}>
                        {editDraft.allowRetry !== false ? <><RefreshCw size={10} /> 재시도 허용</> : <><Ban size={10} /> 재시도 불가</>}
                      </button>
                      <button onClick={() => saveProblemEdit(problem.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                        <Save size={13} /> {saving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-border pt-3 space-y-3">
                    {problem.allowRetry === false && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-500">
                        <Ban size={10} /> 재시도 불가
                      </span>
                    )}
                    <div className="prose-content">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                        {problem.content}
                      </ReactMarkdown>
                    </div>
                    {problem.imageUrls && problem.imageUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {problem.imageUrls.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={url} src={url} alt="" className="max-h-48 rounded-lg border border-border object-contain" />
                        ))}
                      </div>
                    )}
                    {canEditProblems && (
                      <button onClick={() => fileInputRef.current && (fileInputRef.current.dataset.pid = problem.id) && fileInputRef.current.click()} disabled={uploadingProblem === problem.id}
                        className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors disabled:opacity-50">
                        <ImagePlus size={12} /> {uploadingProblem === problem.id ? '업로드 중...' : '이미지 추가'}
                      </button>
                    )}
                    {(isOrganizer || isAdmin || isContributor) && problem.answer && (
                      <p className="text-xs text-muted">정답: <span className="font-mono text-accent">{problem.answer}</span>
                        {problem.extraAnswers && problem.extraAnswers.length > 0 && (
                          <span className="ml-1">, {problem.extraAnswers.join(', ')}</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {contest.status === 'ONGOING' && isParticipant && !solved && !isEditing && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <input
                      value={answers[problem.id] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [problem.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit(problem.id)}
                      placeholder="정답 입력 후 Enter"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button onClick={() => handleSubmit(problem.id)} disabled={submitting === problem.id}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                      {submitting === problem.id ? '...' : '제출'}
                    </button>
                  </div>
                )}
                {solved && <div className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> 정답!</div>}
              </div>
            )
          })}
          {contest.problems.length === 0 && <div className="text-center py-8 text-text-secondary text-sm">문제가 없습니다</div>}
          {/* hidden file input for problem image upload */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              const pid = fileInputRef.current?.dataset.pid
              if (f && pid) uploadProblemImage(pid, f)
              if (e.target) e.target.value = ''
            }} />
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">아직 참가자가 없습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">순위</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">참가자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">해결</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">점수</th>
              </tr></thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.user.id} className={`border-b border-border last:border-0 hover:bg-surface-2 transition-colors ${session?.user?.id === entry.user.id ? 'bg-accent/5' : ''}`}>
                    <td className="px-4 py-3">
                      <span className={`w-7 h-7 inline-flex items-center justify-center rounded-lg text-sm font-bold border ${
                        entry.rank === 1 ? 'text-yellow-700 bg-yellow-50 border-yellow-300' :
                        entry.rank === 2 ? 'text-gray-600 bg-gray-100 border-gray-300' :
                        entry.rank === 3 ? 'text-orange-700 bg-orange-50 border-orange-300' :
                        'text-muted border-transparent'}`}>{entry.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={entry.user.name} image={entry.user.image} size={24} />
                        <span className="font-medium text-text-primary">{entry.user.name ?? '?'}</span>
                        {session?.user?.id === entry.user.id && <span className="text-xs text-accent">(나)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {entry.solvedProblems.map((s) => (
                          <span key={s.problem.label} className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded font-medium">
                            {s.problem.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-accent">{entry.score}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Chat */}
      {tab === 'chat' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
          <div className="px-4 py-3 border-b border-border text-sm font-semibold text-text-primary flex items-center gap-2">
            <MessageSquare size={14} className="text-accent" /> 사전 토론 채팅
            <span className="text-xs text-muted font-normal ml-1">대회 시작 시 삭제됩니다</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
            {chats.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">아직 메시지가 없습니다</div>
            ) : (
              chats.map((c) => (
                <div key={c.id} className={`flex gap-2 ${c.author.id === session?.user?.id ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={c.author.name} image={c.author.image} size={28} />
                  <div className={`max-w-xs ${c.author.id === session?.user?.id ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {c.author.id !== session?.user?.id && (
                      <span className="text-xs text-muted px-1">{c.author.name}</span>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-sm ${c.author.id === session?.user?.id ? 'bg-accent text-white rounded-tr-sm' : 'bg-surface-2 text-text-primary rounded-tl-sm'}`}>
                      {c.content}
                    </div>
                    <span className="text-xs text-muted px-1">{timeAgo(c.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-3 border-t border-border flex gap-2">
            <input
              value={chatMsg}
              onChange={(e) => setChatMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="메시지 입력..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
              <Send size={13} /> 전송
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      {tab === 'info' && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">대회 정보</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted">제한 시간</span><p className="text-text-primary font-medium">{contest.durationMin}분</p></div>
              <div><span className="text-muted">문제 수</span><p className="text-text-primary font-medium">{contest.problems.length}개</p></div>
              <div><span className="text-muted">참가자</span><p className="text-text-primary font-medium">{contest._count.participants}명</p></div>
              {contest.startTime && <div><span className="text-muted">시작</span><p className="text-text-primary font-medium">{timeAgo(contest.startTime)}</p></div>}
            </div>
          </div>
          {contest.rules && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">규칙</h3>
              <div className="prose-content text-sm">{contest.rules}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

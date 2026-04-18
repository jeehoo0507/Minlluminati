'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { Clock, Users, Trophy, CheckCircle, XCircle, Play } from 'lucide-react'
import toast from 'react-hot-toast'

interface Problem { id: string; label: string; title: string; content: string; points: number }
interface Contest {
  id: string; title: string; description: string; rules: string; status: string
  startTime: string | null; durationMin: number; organizerId: string
  organizer: { id: string; name?: string | null; image?: string | null; points: number }
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
  const [tab, setTab] = useState<'problems' | 'leaderboard' | 'info'>('problems')

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
  const isParticipant = !!contest.myParticipant
  const canStart = (isOrganizer || isAdmin) && contest.status === 'APPROVED'

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
            <p className="text-sm text-text-secondary mt-1">{contest.description}</p>
          </div>
          <div className="text-right shrink-0 space-y-2">
            <div className="text-sm text-muted flex items-center gap-1 justify-end"><Clock size={13} />{contest.durationMin}분</div>
            <div className="text-sm text-muted flex items-center gap-1 justify-end"><Users size={13} />{contest._count.participants}명</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Avatar name={contest.organizer.name} image={contest.organizer.image} size={24} />
          <span className="text-xs text-text-secondary">{contest.organizer.name}</span>
          <TierBadge points={contest.organizer.points} />
        </div>

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
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit">
        {(['problems', 'leaderboard', 'info'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === 'leaderboard') loadLeaderboard() }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            {t === 'problems' ? '문제' : t === 'leaderboard' ? '순위표' : '정보'}
          </button>
        ))}
      </div>

      {/* Problems */}
      {tab === 'problems' && (
        <div className="space-y-4">
          {contest.status === 'APPROVED' && !isParticipant && !isOrganizer && (
            <div className="p-4 bg-surface border border-border rounded-xl text-sm text-text-secondary text-center">
              대회 시작 후 참가자에게 문제가 공개됩니다
            </div>
          )}
          {(contest.status === 'ONGOING' || contest.status === 'ENDED' || isOrganizer || isAdmin) && contest.problems.map((problem) => {
            const solved = contest.mySubmissions?.[problem.id]
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
                  {solved && <CheckCircle size={20} className="text-green-500 shrink-0" />}
                </div>
                <div className="prose-content border-t border-border pt-3">
                  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                    {problem.content}
                  </ReactMarkdown>
                </div>
                {contest.status === 'ONGOING' && isParticipant && !solved && (
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

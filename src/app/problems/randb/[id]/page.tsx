'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ProblemTierBadge } from '@/components/ui/ProblemTierBadge'
import { SUBJECTS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Swords, Clock, ArrowLeft, CheckCircle2, Send, Trophy, Minus } from 'lucide-react'
import toast from 'react-hot-toast'

interface DuelUser {
  id: string
  name?: string | null
  image?: string | null
  points: number
}

interface DuelProblem {
  id: string
  title: string
  problemNumber: number
  subject?: string | null
  approvedPts?: number | null
  content: string
  imageUrls: string
}

interface DuelSub {
  userId: string
  problemId: string
  correct: boolean
}

interface DuelDetail {
  id: string
  status: string
  challengerId: string
  challengedId: string
  challenger: DuelUser
  challenged: DuelUser
  difficulties: string
  problemCount: number
  timeLimit: number
  challengerScore: number
  challengedScore: number
  winnerId?: string | null
  startedAt?: string | null
  endedAt?: string | null
  problems: DuelProblem[]
  submissions: DuelSub[]
}

function useCountdown(endTimeMs: number | null) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    if (!endTimeMs) return
    const tick = () => {
      const left = Math.max(0, Math.floor((endTimeMs - Date.now()) / 1000))
      setRemaining(left)
    }
    tick()
    const iv = setInterval(tick, 500)
    return () => clearInterval(iv)
  }, [endTimeMs])

  return remaining
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function DuelPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const duelId = params.id as string

  const [duel, setDuel] = useState<DuelDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDuel = useCallback(async () => {
    const res = await fetch(`/api/duels/${duelId}`)
    if (res.ok) {
      const data = await res.json()
      setDuel(data)
    } else if (res.status === 403 || res.status === 404) {
      router.push('/problems/randb')
    }
    setLoading(false)
  }, [duelId, router])

  useEffect(() => {
    loadDuel()
  }, [loadDuel])

  // Poll every 3s when active
  useEffect(() => {
    if (duel?.status === 'ACTIVE') {
      pollingRef.current = setInterval(loadDuel, 3000)
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [duel?.status, loadDuel])

  const endTimeMs = duel?.startedAt
    ? new Date(duel.startedAt).getTime() + duel.timeLimit * 1000
    : null
  const remaining = useCountdown(endTimeMs)

  // Auto-reload when timer hits 0
  useEffect(() => {
    if (remaining === 0 && duel?.status === 'ACTIVE') {
      setTimeout(loadDuel, 1500)
    }
  }, [remaining, duel?.status, loadDuel])

  async function submitAnswer(problemId: string) {
    const ans = answers[problemId]?.trim()
    if (!ans) { toast.error('답안을 입력하세요'); return }
    setSubmitting((p) => ({ ...p, [problemId]: true }))
    try {
      const res = await fetch(`/api/duels/${duelId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, answer: ans }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.correct) {
          toast.success('정답! ✅')
          setAnswers((p) => ({ ...p, [problemId]: '' }))
          setExpandedId(null)
          loadDuel()
        } else {
          toast.error('오답입니다 ❌')
        }
        if (data.finished) loadDuel()
      } else {
        toast.error(data.error ?? '제출 실패')
      }
    } finally {
      setSubmitting((p) => ({ ...p, [problemId]: false }))
    }
  }

  if (!session?.user) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-center text-text-secondary">로그인이 필요합니다</div>
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (!duel) return null

  const myId = session.user.id
  const isChallenger = duel.challengerId === myId
  const me = isChallenger ? duel.challenger : duel.challenged
  const opponent = isChallenger ? duel.challenged : duel.challenger
  const myScore = isChallenger ? duel.challengerScore : duel.challengedScore
  const opScore = isChallenger ? duel.challengedScore : duel.challengerScore

  // Derive my solved set from submissions
  const mySolved = new Set(
    duel.submissions.filter((s) => s.userId === myId && s.correct).map((s) => s.problemId),
  )
  const myLiveScore = mySolved.size

  const isWin = duel.status === 'FINISHED' && duel.winnerId === myId
  const isDraw = duel.status === 'FINISHED' && !duel.winnerId
  const isLoss = duel.status === 'FINISHED' && duel.winnerId && duel.winnerId !== myId

  const timerColor =
    remaining > 60 ? 'text-text-primary' :
    remaining > 30 ? 'text-yellow-500' : 'text-red-500'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Back */}
      <Link
        href="/problems/randb"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} /> randB 로비로
      </Link>

      {/* Status banner */}
      {duel.status === 'FINISHED' && (
        <div className={cn(
          'rounded-2xl p-4 text-center border',
          isWin ? 'bg-accent/10 border-accent/30' :
          isDraw ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800' :
          'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
        )}>
          <div className="text-2xl mb-1">
            {isWin ? '🏆' : isDraw ? '⚖️' : '💀'}
          </div>
          <div className={cn(
            'text-lg font-bold',
            isWin ? 'text-accent' : isDraw ? 'text-yellow-600' : 'text-red-500',
          )}>
            {isWin ? '승리!' : isDraw ? '무승부' : '패배'}
          </div>
          <div className="text-3xl font-black text-text-primary mt-1">
            {myLiveScore} : {isChallenger ? duel.challengedScore : duel.challengerScore}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {duel.problemCount}문제 중 내 정답 {myLiveScore}개
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="bg-surface border border-border rounded-2xl p-4">
        <div className="grid grid-cols-3 items-center gap-2">
          {/* Me */}
          <div className="text-center">
            <Avatar name={me.name} image={me.image} size={36} className="mx-auto mb-1" />
            <div className="text-xs font-semibold text-text-primary truncate">{me.name}</div>
            <TierBadge points={me.points} className="justify-center mt-0.5" />
            <div className="text-2xl font-black text-accent mt-1">{myLiveScore}</div>
            <div className="text-[10px] text-text-secondary">/{duel.problemCount}문제</div>
          </div>

          {/* Center: timer / vs */}
          <div className="text-center">
            <div className="text-xs font-semibold text-text-secondary mb-1">VS</div>
            {duel.status === 'ACTIVE' && (
              <div className={cn('text-xl font-black tabular-nums', timerColor)}>
                {formatTimer(remaining)}
              </div>
            )}
            {duel.status === 'PENDING' && (
              <div className="text-xs text-text-secondary">대기 중...</div>
            )}
            {duel.status === 'FINISHED' && (
              <div className="text-sm font-bold text-text-secondary">종료</div>
            )}
            <Swords size={20} className="mx-auto mt-1 text-text-secondary opacity-40" />
          </div>

          {/* Opponent */}
          <div className="text-center">
            <Avatar name={opponent.name} image={opponent.image} size={36} className="mx-auto mb-1" />
            <div className="text-xs font-semibold text-text-primary truncate">{opponent.name}</div>
            <TierBadge points={opponent.points} className="justify-center mt-0.5" />
            <div className="text-2xl font-black text-text-primary mt-1">
              {duel.status === 'FINISHED' ? opScore : '?'}
            </div>
            <div className="text-[10px] text-text-secondary">/{duel.problemCount}문제</div>
          </div>
        </div>
      </div>

      {/* Problems */}
      {(duel.status === 'ACTIVE' || duel.status === 'FINISHED') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              문제 목록 ({myLiveScore}/{duel.problemCount} 정답)
            </h2>
            {duel.status === 'ACTIVE' && (
              <div className={cn('flex items-center gap-1 text-xs font-mono font-bold', timerColor)}>
                <Clock size={12} /> {formatTimer(remaining)}
              </div>
            )}
          </div>

          {duel.problems.map((prob, idx) => {
            const solved = mySolved.has(prob.id)
            const isExpanded = expandedId === prob.id
            const subjectInfo = prob.subject ? SUBJECTS[prob.subject as keyof typeof SUBJECTS] : null

            return (
              <div
                key={prob.id}
                className={cn(
                  'bg-surface border rounded-xl overflow-hidden transition-colors',
                  solved ? 'border-accent/40 bg-accent/5' : 'border-border',
                )}
              >
                {/* Problem header */}
                <button
                  onClick={() => {
                    if (duel.status === 'FINISHED' || solved) return
                    setExpandedId(isExpanded ? null : prob.id)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    solved ? 'bg-accent text-background' : 'bg-surface-2 text-text-secondary',
                  )}>
                    {solved ? <CheckCircle2 size={14} /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-medium truncate',
                        solved ? 'text-accent' : 'text-text-primary',
                      )}>
                        #{prob.problemNumber} {prob.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {subjectInfo && (
                        <span className="text-[10px] text-text-secondary">{subjectInfo.short}</span>
                      )}
                      {prob.approvedPts != null && (
                        <ProblemTierBadge pts={prob.approvedPts} />
                      )}
                    </div>
                  </div>
                  {solved && (
                    <span className="text-xs font-semibold text-accent shrink-0">정답 ✓</span>
                  )}
                  {!solved && duel.status === 'ACTIVE' && (
                    <span className="text-xs text-text-secondary shrink-0">
                      {isExpanded ? '닫기' : '풀기'}
                    </span>
                  )}
                </button>

                {/* Expanded answer input */}
                {isExpanded && duel.status === 'ACTIVE' && !solved && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border">
                    {/* Problem preview */}
                    <div className="pt-3 text-sm text-text-primary leading-relaxed line-clamp-3 whitespace-pre-wrap">
                      {prob.content}
                    </div>
                    <Link
                      href={`/problems/${prob.id}?from=/problems/randb/${duelId}`}
                      target="_blank"
                      className="text-xs text-accent hover:underline"
                    >
                      문제 전체 보기 →
                    </Link>
                    {/* Answer input */}
                    <div className="flex gap-2">
                      <input
                        value={answers[prob.id] ?? ''}
                        onChange={(e) => setAnswers((p) => ({ ...p, [prob.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && submitAnswer(prob.id)}
                        placeholder="정답 입력"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                        autoFocus
                      />
                      <button
                        onClick={() => submitAnswer(prob.id)}
                        disabled={submitting[prob.id]}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                      >
                        <Send size={13} />
                        제출
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {duel.status === 'PENDING' && (
        <div className="text-center py-12">
          <Swords size={40} className="mx-auto mb-3 text-text-secondary opacity-30" />
          <p className="text-text-secondary text-sm">상대방이 대결을 수락하기를 기다리는 중...</p>
          <p className="text-xs text-text-secondary mt-1 opacity-60">수락하면 자동으로 문제가 공개됩니다</p>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { SUBJECTS, PROBLEM_SUBJECTS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Swords, Plus, RefreshCw, Clock, ChevronRight, Check, X, Trophy, Minus } from 'lucide-react'
import toast from 'react-hot-toast'

const DUEL_TIERS = [
  { key: '새싹',   label: '🌱 새싹',   pts: '1-19pt',   color: 'text-green-500' },
  { key: '브론즈',  label: '🥉 브론즈',  pts: '20-49pt',  color: 'text-amber-600' },
  { key: '실버',   label: '🥈 실버',   pts: '50-99pt',  color: 'text-slate-400' },
  { key: '골드',   label: '🥇 골드',   pts: '100-199pt',color: 'text-yellow-500' },
  { key: '플래티넘', label: '💎 플래티넘', pts: '200-499pt',color: 'text-cyan-400' },
  { key: '다이아',  label: '💠 다이아',  pts: '500pt+',   color: 'text-blue-400' },
]

const TIME_PRESETS = [
  { label: '3분',  value: 180  },
  { label: '5분',  value: 300  },
  { label: '10분', value: 600  },
  { label: '15분', value: 900  },
  { label: '30분', value: 1800 },
]

const COUNT_PRESETS = [5, 10, 15, 20]

interface DuelUser {
  id: string
  name?: string | null
  image?: string | null
  points: number
}

interface Duel {
  id: string
  status: string
  challengerId: string
  challengedId: string
  challenger: DuelUser
  challenged: DuelUser
  difficulties: string
  excludedSubjects: string
  problemCount: number
  timeLimit: number
  challengerScore: number
  challengedScore: number
  winnerId?: string | null
  startedAt?: string | null
  createdAt: string
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}분 ${s.toString().padStart(2, '0')}초`
}

function DuelCard({
  duel,
  myId,
  onAction,
}: {
  duel: Duel
  myId: string
  onAction: (id: string, action: 'accept' | 'decline' | 'cancel') => void
}) {
  const isChallenger = duel.challengerId === myId
  const opponent = isChallenger ? duel.challenged : duel.challenger
  const myScore = isChallenger ? duel.challengerScore : duel.challengedScore
  const opScore = isChallenger ? duel.challengedScore : duel.challengerScore
  const difficulties: string[] = (() => { try { return JSON.parse(duel.difficulties) } catch { return [] } })()
  const excluded: string[] = (() => { try { return JSON.parse(duel.excludedSubjects) } catch { return [] } })()

  const isWin = duel.winnerId === myId
  const isDraw = duel.status === 'FINISHED' && !duel.winnerId
  const isLoss = duel.status === 'FINISHED' && duel.winnerId && duel.winnerId !== myId

  return (
    <div className={cn(
      'bg-surface border rounded-xl p-4 transition-colors',
      duel.status === 'ACTIVE' ? 'border-accent/50 bg-accent/5' : 'border-border',
    )}>
      <div className="flex items-center justify-between gap-3">
        {/* Opponent info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={opponent.name} image={opponent.image} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-text-primary truncate">{opponent.name}</span>
              <TierBadge points={opponent.points} />
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {difficulties.slice(0, 3).map((d) => {
                const t = DUEL_TIERS.find((t) => t.key === d)
                return t ? (
                  <span key={d} className={cn('text-[10px] font-medium', t.color)}>{t.label}</span>
                ) : null
              })}
              {difficulties.length > 3 && (
                <span className="text-[10px] text-text-secondary">+{difficulties.length - 3}</span>
              )}
              <span className="text-[10px] text-text-secondary">· {duel.problemCount}문제 · {formatTime(duel.timeLimit)}</span>
            </div>
            {excluded.length > 0 && (
              <p className="text-[10px] text-text-secondary mt-0.5">
                제외: {excluded.map((k) => SUBJECTS[k as keyof typeof SUBJECTS]?.short ?? k).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Status / actions */}
        <div className="flex items-center gap-2 shrink-0">
          {duel.status === 'PENDING' && !isChallenger && (
            <>
              <button
                onClick={() => onAction(duel.id, 'accept')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-dim transition-colors"
              >
                <Check size={12} /> 수락
              </button>
              <button
                onClick={() => onAction(duel.id, 'decline')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-red-400 hover:border-red-300 transition-colors"
              >
                <X size={12} /> 거절
              </button>
            </>
          )}
          {duel.status === 'PENDING' && isChallenger && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">응답 대기 중...</span>
              <button
                onClick={() => onAction(duel.id, 'cancel')}
                className="text-xs text-text-secondary hover:text-red-400 transition-colors"
              >
                취소
              </button>
            </div>
          )}
          {duel.status === 'ACTIVE' && (
            <Link
              href={`/problems/randb/${duel.id}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-dim transition-colors animate-pulse"
            >
              <Swords size={12} /> 입장 <ChevronRight size={12} />
            </Link>
          )}
          {duel.status === 'FINISHED' && (
            <div className="flex items-center gap-2">
              <div className="text-center">
                <div className="text-sm font-bold text-text-primary">{myScore} : {opScore}</div>
                <div className={cn(
                  'text-xs font-semibold',
                  isWin ? 'text-accent' : isDraw ? 'text-yellow-500' : 'text-red-400',
                )}>
                  {isWin ? '🏆 승리' : isDraw ? '⚖️ 무승부' : '💀 패배'}
                </div>
              </div>
              <Link
                href={`/problems/randb/${duel.id}`}
                className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <ChevronRight size={14} className="text-text-secondary" />
              </Link>
            </div>
          )}
          {duel.status === 'DECLINED' && (
            <span className="text-xs text-text-secondary">거절됨</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RandBPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [duels, setDuels] = useState<Duel[]>([])
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [targetName, setTargetName] = useState('')
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(['실버', '골드'])
  const [excludedSubjects, setExcludedSubjects] = useState<string[]>([])
  const [problemCount, setProblemCount] = useState(10)
  const [timeLimit, setTimeLimit] = useState(600)
  const [creating, setCreating] = useState(false)

  const loadDuels = useCallback(async () => {
    const res = await fetch('/api/duels')
    if (res.ok) setDuels(await res.json())
  }, [])

  useEffect(() => {
    if (session?.user) {
      loadDuels()
      const iv = setInterval(loadDuels, 5000)
      return () => clearInterval(iv)
    }
  }, [session, loadDuels])

  async function createDuel() {
    if (!targetName.trim()) { toast.error('상대방 닉네임을 입력하세요'); return }
    if (!selectedDifficulties.length) { toast.error('난이도를 선택하세요'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetName,
          excludedSubjects,
          difficulties: selectedDifficulties,
          problemCount,
          timeLimit,
        }),
      })
      if (res.ok) {
        toast.success('대결 신청을 보냈습니다!')
        setTargetName('')
        setShowForm(false)
        loadDuels()
      } else {
        const err = await res.json()
        toast.error(err.error ?? '신청 실패')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleAction(duelId: string, action: 'accept' | 'decline' | 'cancel') {
    const res = await fetch(`/api/duels/${duelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const data = await res.json()
      if (action === 'accept' && data.duelId) {
        router.push(`/problems/randb/${data.duelId}`)
        return
      }
      toast.success(
        action === 'accept' ? '대결을 수락했습니다!' :
        action === 'decline' ? '대결을 거절했습니다' :
        '대결 신청을 취소했습니다',
      )
      loadDuels()
    } else {
      const err = await res.json()
      toast.error(err.error ?? '처리 실패')
    }
  }

  if (!session?.user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Swords size={48} className="mx-auto mb-4 text-text-secondary opacity-30" />
        <p className="text-text-secondary">로그인이 필요합니다</p>
      </div>
    )
  }

  const myId = session.user.id
  const pendingReceived = duels.filter((d) => d.status === 'PENDING' && d.challengedId === myId)
  const pendingSent = duels.filter((d) => d.status === 'PENDING' && d.challengerId === myId)
  const activeDuels = duels.filter((d) => d.status === 'ACTIVE')
  const finishedDuels = duels.filter((d) => d.status === 'FINISHED' || d.status === 'DECLINED')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Swords size={22} className="text-accent" />
            randB — 1:1 대결
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            제한 시간 안에 더 많은 문제를 풀어보세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDuels}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <RefreshCw size={16} className="text-text-secondary" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
          >
            <Plus size={14} /> 대결 신청
          </button>
        </div>
      </div>

      {/* Create Duel Form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">새 대결 신청</h2>

          {/* Target */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">상대방 닉네임</label>
            <input
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createDuel()}
              placeholder="닉네임 입력"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* Difficulties */}
          <div>
            <label className="text-xs text-text-secondary mb-2 block">허용 난이도 (복수 선택)</label>
            <div className="flex flex-wrap gap-2">
              {DUEL_TIERS.map((t) => (
                <button
                  key={t.key}
                  onClick={() =>
                    setSelectedDifficulties((prev) =>
                      prev.includes(t.key) ? prev.filter((d) => d !== t.key) : [...prev, t.key],
                    )
                  }
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    selectedDifficulties.includes(t.key)
                      ? 'bg-accent text-background border-accent'
                      : 'border-border text-text-secondary hover:border-accent/50',
                  )}
                >
                  {t.label}{' '}
                  <span className="opacity-60">{t.pts}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Excluded subjects */}
          <div>
            <label className="text-xs text-text-secondary mb-2 block">
              제외할 과목 <span className="opacity-60">(선택 안 하면 전체 포함)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PROBLEM_SUBJECTS.map((key) => (
                <button
                  key={key}
                  onClick={() =>
                    setExcludedSubjects((prev) =>
                      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
                    )
                  }
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs border transition-colors',
                    excludedSubjects.includes(key)
                      ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                      : 'border-border text-text-secondary hover:border-accent/50',
                  )}
                >
                  {excludedSubjects.includes(key) ? '✕ ' : ''}
                  {SUBJECTS[key].short}
                </button>
              ))}
            </div>
          </div>

          {/* Problem count */}
          <div>
            <label className="text-xs text-text-secondary mb-2 block">문제 수</label>
            <div className="flex gap-2">
              {COUNT_PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => setProblemCount(n)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    problemCount === n
                      ? 'bg-accent text-background border-accent'
                      : 'border-border text-text-secondary hover:border-accent/50',
                  )}
                >
                  {n}문제
                </button>
              ))}
            </div>
          </div>

          {/* Time limit */}
          <div>
            <label className="text-xs text-text-secondary mb-2 block">제한 시간</label>
            <div className="flex gap-2 flex-wrap">
              {TIME_PRESETS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTimeLimit(t.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    timeLimit === t.value
                      ? 'bg-accent text-background border-accent'
                      : 'border-border text-text-secondary hover:border-accent/50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={createDuel}
              disabled={creating}
              className="flex-1 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {creating ? '신청 중...' : '대결 신청 보내기 ⚔️'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-2 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Received challenges */}
      {pendingReceived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            받은 대결 신청 ({pendingReceived.length})
          </h2>
          {pendingReceived.map((d) => (
            <DuelCard key={d.id} duel={d} myId={myId} onAction={handleAction} />
          ))}
        </section>
      )}

      {/* Active duels */}
      {activeDuels.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            진행 중 ({activeDuels.length})
          </h2>
          {activeDuels.map((d) => (
            <DuelCard key={d.id} duel={d} myId={myId} onAction={handleAction} />
          ))}
        </section>
      )}

      {/* Sent pending */}
      {pendingSent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            보낸 대결 신청
          </h2>
          {pendingSent.map((d) => (
            <DuelCard key={d.id} duel={d} myId={myId} onAction={handleAction} />
          ))}
        </section>
      )}

      {/* Finished */}
      {finishedDuels.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Trophy size={12} /> 종료된 대결
          </h2>
          {finishedDuels.slice(0, 8).map((d) => (
            <DuelCard key={d.id} duel={d} myId={myId} onAction={handleAction} />
          ))}
        </section>
      )}

      {duels.length === 0 && !showForm && (
        <div className="text-center py-16">
          <Swords size={48} className="mx-auto mb-3 text-text-secondary opacity-20" />
          <p className="text-text-secondary text-sm">아직 대결이 없습니다</p>
          <p className="text-text-secondary text-xs mt-1">
            대결 신청 버튼으로 상대방에게 도전해보세요!
          </p>
        </div>
      )}
    </div>
  )
}

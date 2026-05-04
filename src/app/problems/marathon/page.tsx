'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Trophy, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUBJECTS, type SubjectKey } from '@/lib/utils'
import { ProblemTierBadge } from '@/components/ui/ProblemTierBadge'
import toast from 'react-hot-toast'

interface MarathonProblem {
  id: string
  problemNumber: number
  title: string
  subject?: string | null
  approvedPts?: number | null
}

interface MarathonItem {
  id: string
  order: number
  bonusPts: number
  solved: boolean
  solvedAt?: string | null
  bonusAwarded: boolean
  problem: MarathonProblem
}

interface MarathonSession {
  id: string
  weekStart: string
  completionBonusAwarded: boolean
  items: MarathonItem[]
}

interface MarathonData {
  session: MarathonSession
  weekStart: string
  weekEnd: string
  newlySolvedCount: number
  bonusAwarded: number
  completionBonus: number
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

function dayName(dateStr: string) {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(dateStr + 'T00:00:00Z').getUTCDay()]
}

// SVG 체크 아이콘 (이모지 사용 금지)
function CheckIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function MarathonPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<MarathonData | null>(null)
  const [closed, setClosed] = useState(false)
  const [availableCount, setAvailableCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
  const prevDataRef = useRef<MarathonData | null>(null)

  const load = useCallback(async (showToast = false) => {
    try {
      const res = await fetch('/api/marathon')
      if (!res.ok) {
        if (showToast) toast.error('동기화 실패')
        return
      }
      const json: MarathonData & { closed?: boolean; availableCount?: number } = await res.json()

      if (json.closed) {
        setClosed(true)
        setAvailableCount(json.availableCount ?? 0)
        return
      }

      // 새로 해결된 아이템 → 애니메이션
      if (json.newlySolvedCount > 0 && prevDataRef.current) {
        const prev = prevDataRef.current
        const newIds = new Set(
          json.session.items
            .filter((it) => it.solved)
            .filter((it) => {
              const old = prev.session.items.find((o) => o.id === it.id)
              return old && !old.solved
            })
            .map((it) => it.id)
        )
        if (newIds.size > 0) {
          setAnimatingIds(newIds)
          setTimeout(() => setAnimatingIds(new Set()), 900)
        }
      }

      prevDataRef.current = json
      setData(json)

      // 토스트
      if (json.completionBonus > 0) {
        toast.success(`마라톤 완주! 완주 보너스 +${json.completionBonus} 상점 포인트`)
      } else if (json.bonusAwarded > 0) {
        toast.success(`마라톤 보너스 +${json.bonusAwarded} 상점 포인트 획득`)
      } else if (showToast) {
        toast.success('동기화 완료')
      }
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') load()
    else if (status === 'unauthenticated') setLoading(false)
  }, [status, load])

  // ─── 로그인 필요 ───
  if (status === 'unauthenticated') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-text-secondary">로그인이 필요한 기능입니다</p>
        <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold">
          로그인
        </Link>
      </div>
    )
  }

  // ─── 로딩 ───
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="h-6 w-28 bg-surface border border-border rounded animate-pulse" />
        <div className="h-36 bg-surface border border-border rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ─── 문제 부족 (마라톤 닫힘) ───
  if (closed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/problems" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors">
          <ArrowLeft size={15} /> 문제 목록
        </Link>
        <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mx-auto">
            <Lock size={22} className="text-muted" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">마라톤이 잠시 닫혔습니다</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            현재 티어에 맞는 미풀이 문제가 부족합니다<br />
            <span className="text-muted text-xs">({availableCount}개 가능 / 7개 필요)</span>
          </p>
          <p className="text-xs text-muted pt-1">문제를 더 풀거나 새 문제가 추가되면 자동으로 열립니다</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { session: ms, weekStart, weekEnd } = data
  const items = ms.items
  const solvedCount = items.filter((it) => it.solved).length
  const isComplete = solvedCount === 7 && ms.completionBonusAwarded

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <Link
          href="/problems"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={15} /> 문제 목록
        </Link>
        <button
          onClick={() => { setSyncing(true); load(true) }}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          풀이 동기화
        </button>
      </div>

      {/* 제목 + 주간 범위 */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">마라톤</h1>
          {isComplete && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">
              <Trophy size={11} /> 완주
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          {fmtDate(weekStart)}({dayName(weekStart)}) ~ {fmtDate(weekEnd)}({dayName(weekEnd)})
          &nbsp;&middot;&nbsp;
          <span className={cn('font-semibold', solvedCount === 7 ? 'text-accent' : 'text-text-primary')}>
            {solvedCount} / 7 완료
          </span>
        </p>
      </div>

      {/* ─── 원형 프로그레스 스트립 ─── */}
      <div className="bg-surface border border-border rounded-2xl px-6 py-7">
        {/* 원형 + 연결선 */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center justify-center min-w-max mx-auto gap-0">
            {items.map((item, i) => {
              const isAnim = animatingIds.has(item.id)
              return (
                <div key={item.id} className="flex items-center">
                  {/* 원형 버튼 */}
                  <button
                    onClick={() => router.push(`/problems/${item.problem.id}?from=/problems/marathon`)}
                    className="flex flex-col items-center gap-1.5 group"
                    title={`#${item.problem.problemNumber} ${item.problem.title}`}
                  >
                    <div
                      className={cn(
                        'relative w-10 h-10 rounded-full border-2 flex items-center justify-center overflow-hidden',
                        'transition-colors duration-300',
                        item.solved
                          ? 'border-accent'
                          : 'border-border group-hover:border-accent/60'
                      )}
                    >
                      {/* 채워지는 배경 */}
                      <div
                        className={cn(
                          'absolute inset-0 rounded-full bg-accent',
                          isAnim
                            ? 'animate-marathon-pop'
                            : 'transition-transform duration-500 ease-out',
                        )}
                        style={{
                          transform: item.solved ? 'scale(1)' : 'scale(0)',
                          transformOrigin: 'center',
                        }}
                      />
                      {/* 아이콘/번호 */}
                      <span className="relative z-10 flex items-center justify-center">
                        {item.solved ? (
                          <CheckIcon size={15} className="text-white" />
                        ) : (
                          <span className="text-xs font-bold text-text-secondary group-hover:text-accent transition-colors">
                            {item.order}
                          </span>
                        )}
                      </span>
                    </div>
                    {/* 문제 번호 */}
                    <span className="text-[10px] text-muted font-mono">
                      #{item.problem.problemNumber}
                    </span>
                  </button>

                  {/* 연결선 */}
                  {i < items.length - 1 && (
                    <div className="relative h-0.5 w-8 bg-border -mt-5 mx-0.5">
                      <div
                        className="absolute inset-y-0 left-0 bg-accent transition-all duration-600 ease-out"
                        style={{ width: item.solved ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 전체 진행바 */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>전체 진행률</span>
            <span>{Math.round((solvedCount / 7) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(solvedCount / 7) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── 문제 카드 ─── */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">이번 주 문제</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const subjectInfo = item.problem.subject
              ? SUBJECTS[item.problem.subject as SubjectKey]
              : null

            return (
              <Link
                key={item.id}
                href={`/problems/${item.problem.id}?from=/problems/marathon`}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border transition-all',
                  item.solved
                    ? 'bg-accent/5 border-accent/25 hover:border-accent/40'
                    : 'bg-surface border-border hover:border-border-2 hover:bg-surface-2'
                )}
              >
                {/* 순서 배지 */}
                <div
                  className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    item.solved
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-text-secondary'
                  )}
                >
                  {item.solved ? <CheckIcon size={12} /> : item.order}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {subjectInfo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted">
                        {subjectInfo.short}
                      </span>
                    )}
                    <span className="text-xs font-mono text-accent">#{item.problem.problemNumber}</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate">{item.problem.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.problem.approvedPts != null && item.problem.approvedPts > 0 && (
                      <div className="flex items-center gap-1">
                        <ProblemTierBadge pts={item.problem.approvedPts} />
                        <span className="text-xs text-muted">{item.problem.approvedPts}pt</span>
                      </div>
                    )}
                    {item.bonusPts > 0 && !item.bonusAwarded && (
                      <span className="text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                        +{item.bonusPts} SP 보너스
                      </span>
                    )}
                    {item.bonusAwarded && (
                      <span className="text-[10px] text-muted">보너스 지급됨</span>
                    )}
                  </div>
                </div>

                {/* 완료 체크 */}
                {item.solved && (
                  <CheckIcon size={16} className="shrink-0 text-accent mt-0.5" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* 완주 메시지 */}
      {isComplete && (
        <div className="bg-accent/8 border border-accent/20 rounded-2xl p-6 text-center space-y-2">
          <Trophy size={28} className="text-accent mx-auto" />
          <h3 className="text-base font-bold text-text-primary">이번 주 마라톤 완주!</h3>
          <p className="text-sm text-text-secondary">
            다음 주 월요일에 새로운 7문제가 준비됩니다
          </p>
        </div>
      )}

      {/* 보너스 안내 */}
      <div className="text-xs text-muted bg-surface border border-border rounded-xl p-4 space-y-1">
        <p className="font-semibold text-text-secondary">마라톤 보너스 안내</p>
        <p>각 문제 클리어 시: 문제 포인트 + 동일 금액만큼 상점 포인트(SP) 추가 지급</p>
        <p>7문제 모두 완주 시: +{20} SP 완주 보너스 추가 지급</p>
        <p>매주 월요일 KST 0시 기준으로 새로운 7문제가 제공됩니다</p>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ProblemTierBadge } from '@/components/ui/ProblemTierBadge'
import { SUBJECTS, timeAgo, type SubjectKey, cn } from '@/lib/utils'
import { ArrowLeft, BookOpen, Trash2, Plus, CheckCircle2, Circle, BarChart2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Problem {
  id: string
  problemNumber: number
  title: string
  subject?: string | null
  status: string
  approvedPts?: number | null
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { submissions: number }
}

interface SetItem {
  id: string
  order: number
  problemId: string
  problem: Problem
  solved: boolean
  tried: boolean
  correctCount: number
}

interface ProblemSet {
  id: string
  title: string
  description: string
  isPublic: boolean
  authorId: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  items: SetItem[]
  progress: { solved: number; total: number; percent: number }
}

export default function ProblemSetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()

  const [set, setSet] = useState<ProblemSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [addNumber, setAddNumber] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/problems/sets/${id}`)
    if (res.ok) {
      setSet(await res.json())
    } else {
      router.push('/problems/sets')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleAddProblem(e: React.FormEvent) {
    e.preventDefault()
    if (!addNumber.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/problems/sets/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemNumber: parseInt(addNumber) }),
      })
      if (res.ok) {
        toast.success('문제가 추가되었습니다')
        setAddNumber('')
        await load()
      } else {
        toast.error((await res.json()).error ?? '추가 실패')
      }
    } finally { setAdding(false) }
  }

  async function handleRemoveProblem(problemId: string, problemNumber: number) {
    if (!confirm(`#${problemNumber} 문제를 문제집에서 제거하시겠습니까?`)) return
    const res = await fetch(`/api/problems/sets/${id}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId }),
    })
    if (res.ok) { toast.success('제거되었습니다'); await load() }
    else toast.error('제거 실패')
  }

  async function handleDeleteSet() {
    if (!confirm('문제집을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/problems/sets/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('문제집이 삭제되었습니다'); router.push('/problems/sets') }
    else toast.error('삭제 실패')
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />)}
    </div>
  )

  if (!set) return null

  const isOwner = session?.user?.id === set.authorId
  const isAdmin = session?.user?.role === 'ADMIN'
  const canManage = isOwner || isAdmin
  const isLoggedIn = !!session?.user
  const { solved, total, percent } = set.progress

  // Progress bar color
  const barColor = percent === 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-accent' : 'bg-amber-400'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link href="/problems/sets" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} /> 문제집 목록
      </Link>

      {/* Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <BookOpen size={24} className="text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">{set.title}</h1>
              {set.description && (
                <p className="text-sm text-text-secondary mt-1">{set.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Avatar name={set.author.name} image={set.author.image} size={20} />
                <span className="text-sm text-text-secondary">{set.author.name}</span>
                <TierBadge points={set.author.points} />
                <span className="text-xs text-muted">{timeAgo(set.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-accent">{total}문제</span>
            {canManage && (
              <button onClick={handleDeleteSet}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-red-400 hover:bg-red-400/5 border border-transparent hover:border-red-400/20 transition-all">
                <Trash2 size={12} /> 삭제
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {percent === 100 ? (
                  <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                    <CheckCircle2 size={15} /> 완료!
                  </span>
                ) : (
                  <span className="text-text-secondary font-medium">진행도</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                {isLoggedIn && (
                  <span className={cn('font-bold text-sm', percent === 100 ? 'text-emerald-500' : 'text-text-primary')}>
                    {solved} / {total}
                  </span>
                )}
                <span>{percent}%</span>
              </div>
            </div>
            <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${percent}%` }}
              />
            </div>
            {isLoggedIn && (
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> 해결 {solved}</span>
                <span className="flex items-center gap-1"><XCircle size={11} className="text-amber-400" /> 시도 {set.items.filter(i => i.tried && !i.solved).length}</span>
                <span className="flex items-center gap-1"><Circle size={11} /> 미시도 {set.items.filter(i => !i.tried).length}</span>
              </div>
            )}
          </div>
        )}

        {/* Add problem (owner only) */}
        {canManage && (
          <form onSubmit={handleAddProblem} className="flex items-center gap-2 pt-2 border-t border-border">
            <label className="text-sm text-text-secondary whitespace-nowrap">문제 추가:</label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted">#</span>
              <input
                type="number" min={1} value={addNumber}
                onChange={(e) => setAddNumber(e.target.value)}
                placeholder="문제 번호"
                className="w-28 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button type="submit" disabled={adding || !addNumber.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
              <Plus size={13} /> {adding ? '추가 중...' : '추가'}
            </button>
          </form>
        )}
      </div>

      {/* Problem list */}
      {set.items.length > 0 ? (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_5rem_4rem_2.5rem] gap-3 px-4 py-2 border-b border-border bg-surface-2 text-xs font-semibold text-text-secondary">
            <span className="text-center">#</span>
            <span>문제</span>
            <span className="text-center">정답률</span>
            <span className="text-center">난이도</span>
            <span className="text-center">상태</span>
          </div>

          {set.items.map((item, idx) => {
            const p = item.problem
            const subjectInfo = p.subject ? SUBJECTS[p.subject as SubjectKey] : null
            const solveRate = p._count.submissions > 0
              ? Math.round((item.correctCount / p._count.submissions) * 100)
              : null

            return (
              <div
                key={item.id}
                className={cn(
                  'grid grid-cols-[2rem_1fr_5rem_4rem_2.5rem] gap-3 px-4 py-3 border-b border-border last:border-0 group transition-colors',
                  item.solved
                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                    : item.tried
                    ? 'bg-amber-400/5 hover:bg-amber-400/10'
                    : 'hover:bg-surface-2'
                )}
              >
                {/* Index */}
                <div className="flex items-center justify-center text-sm font-medium text-muted">{idx + 1}</div>

                {/* Problem info */}
                <Link href={`/problems/${p.id}`} className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-accent">#{p.problemNumber}</span>
                      {subjectInfo && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-border text-text-secondary">
                          {subjectInfo.short}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-sm font-medium truncate group-hover:text-accent transition-colors',
                      item.solved ? 'text-emerald-600' : 'text-text-primary'
                    )}>
                      {p.title}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Avatar name={p.author.name} image={p.author.image} size={12} />
                      <span className="text-xs text-muted">{p.author.name}</span>
                    </div>
                  </div>
                </Link>

                {/* Solve rate */}
                <div className="flex flex-col items-center justify-center gap-0.5">
                  {solveRate !== null ? (
                    <>
                      <span className="text-sm font-semibold text-text-primary">{solveRate}%</span>
                      <div className="flex items-center gap-0.5 text-xs text-muted">
                        <BarChart2 size={10} />
                        <span>{p._count.submissions}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </div>

                {/* Difficulty */}
                <div className="flex items-center justify-center">
                  <ProblemTierBadge pts={p.approvedPts} />
                </div>

                {/* Status icon */}
                <div className="flex items-center justify-center">
                  {item.solved ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : item.tried ? (
                    <XCircle size={18} className="text-amber-400" />
                  ) : (
                    <Circle size={18} className="text-muted/40" />
                  )}
                </div>

                {/* Remove button (hover, owner only) */}
                {canManage && (
                  <div className="col-span-5 flex justify-end -mt-2 pb-0 opacity-0 group-hover:opacity-100 transition-all h-0 overflow-visible">
                    <button
                      onClick={() => handleRemoveProblem(p.id, p.problemNumber)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-muted hover:text-red-400 hover:bg-red-400/5 transition-all"
                    >
                      <Trash2 size={11} /> 제거
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <BookOpen size={40} className="mx-auto text-muted mb-3" />
          <p className="text-text-secondary">아직 문제가 없습니다</p>
          {canManage && <p className="text-sm text-muted mt-2">문제 번호를 입력하여 추가해보세요</p>}
        </div>
      )}
    </div>
  )
}

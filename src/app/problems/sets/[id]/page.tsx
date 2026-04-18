'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { SUBJECTS, timeAgo, type SubjectKey, cn } from '@/lib/utils'
import { ArrowLeft, BookOpen, Trash2, Plus, CheckCircle2, BarChart2 } from 'lucide-react'
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
        const err = await res.json()
        toast.error(err.error ?? '추가 실패')
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
    if (res.ok) {
      toast.success('제거되었습니다')
      await load()
    } else toast.error('제거 실패')
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/problems/sets" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        문제집 목록
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
            <span className="text-sm font-bold text-accent">{set.items.length}문제</span>
            {canManage && (
              <button
                onClick={handleDeleteSet}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-red-400 hover:bg-red-400/5 border border-transparent hover:border-red-400/20 transition-all"
              >
                <Trash2 size={12} />
                삭제
              </button>
            )}
          </div>
        </div>

        {/* Add problem (owner only) */}
        {canManage && (
          <form onSubmit={handleAddProblem} className="flex items-center gap-2 pt-2 border-t border-border">
            <label className="text-sm text-text-secondary whitespace-nowrap">문제 추가:</label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted">#</span>
              <input
                type="number"
                min={1}
                value={addNumber}
                onChange={(e) => setAddNumber(e.target.value)}
                placeholder="문제 번호"
                className="w-28 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={adding || !addNumber.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              <Plus size={13} />
              {adding ? '추가 중...' : '추가'}
            </button>
          </form>
        )}
      </div>

      {/* Problem list */}
      {set.items.length > 0 ? (
        <div className="space-y-2">
          {set.items.map((item, idx) => {
            const p = item.problem
            const subjectInfo = p.subject ? SUBJECTS[p.subject as SubjectKey] : null

            return (
              <div key={item.id} className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-border-2 transition-colors group">
                {/* Order */}
                <div className="w-8 text-center text-sm font-medium text-muted shrink-0">{idx + 1}</div>

                {/* Problem link */}
                <Link href={`/problems/${p.id}`} className="flex-1 min-w-0 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono font-semibold text-accent">#{p.problemNumber}</span>
                      {subjectInfo && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-border text-text-secondary">
                          {subjectInfo.short}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Avatar name={p.author.name} image={p.author.image} size={14} />
                        <span className="text-xs text-muted">{p.author.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-muted mb-1">
                      <BarChart2 size={11} />
                      {p._count.submissions}명
                    </div>
                    {p.approvedPts != null && p.approvedPts > 0 && (
                      <div className="flex items-center gap-0.5 text-xs font-semibold text-accent justify-end">
                        <CheckCircle2 size={11} />
                        {p.approvedPts}pt
                      </div>
                    )}
                  </div>
                </Link>

                {/* Remove button */}
                {canManage && (
                  <button
                    onClick={() => handleRemoveProblem(p.id, p.problemNumber)}
                    className={cn(
                      'shrink-0 p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/5 transition-all',
                      'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <BookOpen size={40} className="mx-auto text-muted mb-3" />
          <p className="text-text-secondary">아직 문제가 없습니다</p>
          {canManage && (
            <p className="text-sm text-muted mt-2">문제 번호를 입력하여 추가해보세요</p>
          )}
        </div>
      )}
    </div>
  )
}

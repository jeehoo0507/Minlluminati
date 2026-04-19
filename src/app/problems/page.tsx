'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ProblemTierBadge } from '@/components/ui/ProblemTierBadge'
import { SUBJECTS, PROBLEM_SUBJECTS, timeAgo, type SubjectKey } from '@/lib/utils'
import { Search, PenLine, ListChecks, BookOpen, BarChart2, Menu, X, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Problem {
  id: string
  problemNumber: number
  title: string
  subject?: string | null
  status: string
  requestedPts: number
  approvedPts?: number | null
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { submissions: number }
  solveRate: number
  correctCount: number
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: '검토중', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  APPROVED: { label: '승인', cls: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: '반려', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default function ProblemsPage() {
  const { data: session } = useSession()
  const [problems, setProblems] = useState<Problem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'sets'>('list')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (query) params.set('q', query)
      if (subject) params.set('subject', subject)
      const res = await fetch(`/api/problems?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProblems(data.problems)
        setTotal(data.total)
        setPages(data.pages)
      }
    } finally {
      setLoading(false)
    }
  }, [page, query, subject])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  function handleSubjectFilter(key: string) {
    setSubject(key === subject ? '' : key)
    setPage(1)
    setSidebarOpen(false)
  }

  const SidebarContent = () => (
    <nav className="space-y-1">
      <p className="px-3 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">메뉴</p>
      <button
        onClick={() => { setActiveTab('list'); setSidebarOpen(false) }}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          activeTab === 'list' ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
        )}
      >
        <ListChecks size={15} />
        문제 목록
      </button>
      <Link
        href="/problems/sets"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        onClick={() => setSidebarOpen(false)}
      >
        <BookOpen size={15} />
        문제집
      </Link>

      <div className="pt-4">
        <p className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider">과목 필터</p>
        <button
          onClick={() => handleSubjectFilter('')}
          className={cn(
            'w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors',
            !subject ? 'text-accent bg-accent/10 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
          )}
        >
          전체
        </button>
        {PROBLEM_SUBJECTS.map((key) => (
          <button
            key={key}
            onClick={() => handleSubjectFilter(key)}
            className={cn(
              'w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors',
              subject === key ? 'text-accent bg-accent/10 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
            )}
          >
            {SUBJECTS[key].label}
          </button>
        ))}
      </div>
    </nav>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
      {/* Desktop Sidebar */}
      <aside className="w-56 shrink-0 hidden lg:block">
        <div className="sticky top-20">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border p-4 overflow-y-auto lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-text-primary text-sm">문제 목록</span>
              <button onClick={() => setSidebarOpen(false)}><X size={16} className="text-muted" /></button>
            </div>
            <SidebarContent />
          </div>
        </>
      )}

      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">문제 목록</h1>
            <p className="text-sm text-text-secondary mt-0.5">문제를 풀고 포인트를 획득하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/problems/sets" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
              <BookOpen size={14} />
              문제집
            </Link>
            {session?.user && (
              <Link href="/problems/new" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors">
                <PenLine size={14} />
                문제 출제
              </Link>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <Menu size={15} /> 필터
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="문제 검색..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <button type="submit" className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
              검색
            </button>
          </form>
        </div>

        {/* Active filters */}
        {(query || subject) && (
          <div className="flex items-center gap-2 flex-wrap">
            {query && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-md text-xs text-text-secondary">
                검색: {query}
                <button onClick={() => { setQuery(''); setSearch('') }} className="ml-1 hover:text-red-400"><X size={10} /></button>
              </span>
            )}
            {subject && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-md text-xs text-text-secondary">
                과목: {SUBJECTS[subject as SubjectKey]?.label}
                <button onClick={() => setSubject('')} className="ml-1 hover:text-red-400"><X size={10} /></button>
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <p className="text-sm text-text-secondary">
          총 <strong className="text-text-primary">{total}</strong>개 문제
        </p>

        {/* Problem List */}
        {loading && problems.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : problems.length > 0 ? (
          <div className="space-y-2">
            {problems.map((p) => {
              const subjectInfo = p.subject ? SUBJECTS[p.subject as SubjectKey] : null
              const status = STATUS_LABELS[p.status] ?? STATUS_LABELS.PENDING
              const isOwn = session?.user?.id === p.author.id
              const isAdmin = session?.user?.role === 'ADMIN'

              return (
                <Link
                  key={p.id}
                  href={`/problems/${p.id}`}
                  className="flex items-start gap-3 p-4 bg-surface border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all"
                >
                  {/* Number */}
                  <div className="shrink-0 w-10 text-center">
                    <span className="text-sm font-mono font-semibold text-accent">#{p.problemNumber}</span>
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {subjectInfo && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-border text-text-secondary">
                          {subjectInfo.short}
                        </span>
                      )}
                      {(isOwn || isAdmin) && p.status !== 'APPROVED' && (
                        <span className={cn('text-xs px-1.5 py-0.5 rounded border', status.cls)}>
                          {status.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary truncate">{p.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <Avatar name={p.author.name} image={p.author.image} size={16} />
                        <span className="text-xs text-muted">{p.author.name}</span>
                        <TierBadge points={p.author.points} />
                      </div>
                      <span className="text-xs text-muted">{timeAgo(p.createdAt)}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="shrink-0 text-right space-y-1">
                    <div className="flex items-center gap-1 justify-end">
                      <BarChart2 size={12} className="text-muted" />
                      <span className="text-xs text-muted">{p._count.submissions}명 도전</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <CheckCircle2 size={12} className={p.solveRate >= 50 ? 'text-green-500' : 'text-orange-400'} />
                      <span className="text-xs text-muted">{p.solveRate}% 정답</span>
                    </div>
                    {p.approvedPts != null && p.approvedPts > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <ProblemTierBadge pts={p.approvedPts} />
                        <span className="text-xs font-semibold text-accent">{p.approvedPts}pt</span>
                      </div>
                    )}
                    {p.status === 'PENDING' && p.requestedPts > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <Clock size={11} className="text-muted" />
                        <span className="text-xs text-muted">{p.requestedPts}pt 요청</span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-text-secondary">문제가 없습니다</p>
            {session?.user && (
              <Link href="/problems/new" className="mt-4 inline-block text-accent text-sm hover:underline">
                첫 번째 문제를 출제해보세요!
              </Link>
            )}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-1 pt-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-8 h-8 rounded-lg text-sm transition-colors',
                  p === page ? 'bg-accent text-background font-semibold' : 'text-text-secondary hover:bg-surface-2'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ProblemTierBadge } from '@/components/ui/ProblemTierBadge'
import { SUBJECTS, PROBLEM_SUBJECTS, timeAgo, type SubjectKey } from '@/lib/utils'
import { Search, PenLine, ListChecks, BookOpen, BarChart2, Menu, X, CheckCircle2, Clock, SortAsc, User, Footprints, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Problem {
  id: string
  problemNumber: number
  title: string
  subject?: string | null
  status: string
  requestedPts: number
  approvedPts?: number | null
  contestId?: string | null
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
  const [sort, setSort] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('problems_sort') ?? 'number_desc'
    return 'number_desc'
  })
  const [solvedFilter, setSolvedFilter] = useState<'all' | 'solved' | 'unsolved'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('problems_solved') as 'all' | 'solved' | 'unsolved') ?? 'all'
    return 'all'
  })
  const [contestOnly, setContestOnly] = useState(false)
  const [authorSearch, setAuthorSearch] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'sets'>('list')
  const isFirstRender = useRef(true)

  // sort/filter 변경 시 localStorage에 저장
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    localStorage.setItem('problems_sort', sort)
    localStorage.setItem('problems_solved', solvedFilter)
  }, [sort, solvedFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (query) params.set('q', query)
      if (subject) params.set('subject', subject)
      if (sort) params.set('sort', sort)
      if (authorQuery) params.set('author', authorQuery)
      if (solvedFilter !== 'all') params.set('solved', solvedFilter)
      if (contestOnly) params.set('contest', 'true')
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
  }, [page, query, subject, sort, authorQuery, solvedFilter, contestOnly])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
    setAuthorQuery(authorSearch)
  }

  function handleSortChange(newSort: string) {
    setSort(newSort)
    setPage(1)
  }

  function handleSolvedFilterChange(val: 'all' | 'solved' | 'unsolved') {
    setSolvedFilter(val)
    setPage(1)
  }

  function handleSortAndFilter(newSort: string, newFilter: 'all' | 'solved' | 'unsolved') {
    setSort(newSort)
    setSolvedFilter(newFilter)
    setPage(1)
  }

  function handleSubjectFilter(key: string) {
    setSubject(key === subject ? '' : key)
    setContestOnly(false)
    setPage(1)
    setSidebarOpen(false)
  }

  function handleContestFilter() {
    setContestOnly((prev) => !prev)
    setSubject('')
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
      <Link
        href="/problems/marathon"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        onClick={() => setSidebarOpen(false)}
      >
        <Footprints size={15} />
        마라톤
      </Link>
      <Link
        href="/problems/randb"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        onClick={() => setSidebarOpen(false)}
      >
        <Swords size={15} />
        randB 대결
      </Link>

      <div className="pt-4">
        <p className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider">과목 필터</p>
        <button
          onClick={() => { setSubject(''); setContestOnly(false); setPage(1); setSidebarOpen(false) }}
          className={cn(
            'w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors',
            !subject && !contestOnly ? 'text-accent bg-accent/10 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
          )}
        >
          전체
        </button>
        <button
          onClick={handleContestFilter}
          className={cn(
            'w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors',
            contestOnly ? 'text-accent bg-accent/10 font-medium' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
          )}
        >
          🏆 대회 출제
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
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border p-4 overflow-y-auto lg:hidden animate-slide-in-left">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-text-primary text-sm">필터</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <X size={16} className="text-muted" />
              </button>
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
        <div className="space-y-2">
          {/* Row 1: 필터 버튼 + 검색 + 출제자 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <Menu size={15} /> 필터
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex gap-2 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="#번호 또는 제목 검색..."
                  className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div className="relative hidden sm:block w-32 shrink-0">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  placeholder="출제자"
                  className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <button type="submit" className="shrink-0 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
                검색
              </button>
            </form>
          </div>
          {/* Row 2 (모바일): 출제자 검색 + 정렬 select */}
          <div className="flex items-center gap-2 sm:justify-end">
            <div className="relative flex-1 sm:hidden">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={authorSearch}
                onChange={(e) => setAuthorSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setAuthorQuery(authorSearch) } }}
                placeholder="출제자 검색"
                className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
            {/* Sort + Solved filter */}
            <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden text-xs shrink-0">
              <SortAsc size={13} className="ml-2 text-muted shrink-0" />
              <select
                value={`${sort}:${solvedFilter}`}
                onChange={(e) => {
                  const [newSort, newFilter] = e.target.value.split(':')
                  handleSortAndFilter(newSort, newFilter as 'all' | 'solved' | 'unsolved')
                }}
                className="bg-surface text-text-secondary py-2 pl-1 pr-2 focus:outline-none text-xs"
              >
                <option value="number_desc:all">번호 내림차순</option>
                <option value="number_asc:all">번호 오름차순</option>
                {session?.user && (
                  <>
                    <option value="number_desc:unsolved">안 푼 문제</option>
                    <option value="number_desc:solved">푼 문제</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Active filters */}
        {(query || subject || authorQuery || solvedFilter !== 'all' || contestOnly) && (
          <div className="flex items-center gap-2 flex-wrap">
            {query && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-md text-xs text-text-secondary">
                검색: {query}
                <button onClick={() => { setQuery(''); setSearch('') }} className="ml-1 hover:text-red-400"><X size={10} /></button>
              </span>
            )}
            {authorQuery && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-md text-xs text-text-secondary">
                출제자: {authorQuery}
                <button onClick={() => { setAuthorQuery(''); setAuthorSearch('') }} className="ml-1 hover:text-red-400"><X size={10} /></button>
              </span>
            )}
            {subject && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-md text-xs text-text-secondary">
                과목: {SUBJECTS[subject as SubjectKey]?.label}
                <button onClick={() => setSubject('')} className="ml-1 hover:text-red-400"><X size={10} /></button>
              </span>
            )}
            {contestOnly && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 border border-violet-400/40 rounded-md text-xs text-violet-500">
                🏆 대회 출제
                <button onClick={() => setContestOnly(false)} className="ml-1 hover:text-red-400"><X size={10} /></button>
              </span>
            )}
            {session?.user && solvedFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-md text-xs text-text-secondary">
                {solvedFilter === 'solved' ? '✓ 푼 문제' : '✗ 안 푼 문제'}
                <button onClick={() => handleSolvedFilterChange('all')} className="ml-1 hover:text-red-400"><X size={10} /></button>
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
                      {p.contestId && (
                        <span className="text-xs px-1.5 py-0.5 rounded border border-violet-400/40 text-violet-500">🏆</span>
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
                    {/* 모바일에선 제출자 수 숨김 */}
                    <div className="hidden sm:flex items-center gap-1 justify-end">
                      <BarChart2 size={12} className="text-muted" />
                      <span className="text-xs text-muted">{p._count.submissions}명 도전</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <CheckCircle2 size={12} className={p.solveRate >= 50 ? 'text-green-500' : 'text-orange-400'} />
                      <span className="text-xs text-muted">{p.solveRate}%</span>
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
                        <span className="text-xs text-muted">{p.requestedPts}pt</span>
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

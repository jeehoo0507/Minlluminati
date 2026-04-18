'use client'
import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { PostCard } from '@/components/post/PostCard'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Search, PenLine, RefreshCw } from 'lucide-react'

interface Post {
  id: string
  title: string
  content: string
  subject: string
  unit?: string | null
  type: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { likes: number; comments: number }
}

export default function FeedPage() {
  const { data: session } = useSession()
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (query) params.set('q', query)
      const res = await fetch(`/api/posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts)
        setTotal(data.total)
        setPages(data.pages)
      }
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
      <Sidebar />

      <div className="flex-1 min-w-0 space-y-4">
        {/* Search + Write */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="제목, 내용 검색..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <button type="submit" className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
              검색
            </button>
          </form>
          {session?.user && (
            <Link
              href="/post/new"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors whitespace-nowrap"
            >
              <PenLine size={14} />
              글쓰기
            </Link>
          )}
        </div>

        {/* Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {query ? `"${query}" 검색 결과 · ` : ''}총 <strong className="text-text-primary">{total}</strong>개
          </p>
          <button onClick={load} className="text-muted hover:text-text-secondary transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Posts */}
        {loading && posts.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-text-secondary">아직 게시글이 없습니다</p>
            {session?.user && (
              <Link href="/post/new" className="mt-4 inline-block text-accent text-sm hover:underline">
                첫 번째 문제를 올려보세요!
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
                className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                  p === page ? 'bg-accent text-background font-semibold' : 'text-text-secondary hover:bg-surface-2'
                }`}
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

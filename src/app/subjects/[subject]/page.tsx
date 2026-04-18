'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { PostCard } from '@/components/post/PostCard'
import { Sidebar, MobileSidebarButton } from '@/components/layout/Sidebar'
import { SUBJECTS, UNITS, type SubjectKey } from '@/lib/utils'
import Link from 'next/link'
import { PenLine } from 'lucide-react'
import { useSession } from 'next-auth/react'

type Post = {
  id: string; title: string; content: string; subject: string; unit?: string | null; type: string; createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { likes: number; comments: number }
}

export default function SubjectPage() {
  const { subject } = useParams<{ subject: string }>()
  const { data: session } = useSession()
  const key = subject.toUpperCase() as SubjectKey
  const subjectInfo = SUBJECTS[key]
  const units = UNITS[key] ?? []

  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [unit, setUnit] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ subject: key, limit: '50' })
      if (unit) params.set('unit', unit)
      const res = await fetch(`/api/posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [key, unit])

  useEffect(() => { load() }, [load])

  if (!subjectInfo) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-text-secondary">과목을 찾을 수 없습니다</p></div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
      <Sidebar />
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MobileSidebarButton />
            <div>
              <h1 className="text-xl font-bold text-text-primary">{subjectInfo.label}</h1>
              <p className="text-sm text-text-secondary mt-0.5">총 {total}개의 게시글</p>
            </div>
          </div>
          {session?.user && (
            <Link
              href={`/post/new?subject=${key}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <PenLine size={14} />
              글쓰기
            </Link>
          )}
        </div>

        {/* Unit filter */}
        {units.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setUnit('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!unit ? 'bg-accent text-background' : 'bg-surface border border-border text-text-secondary hover:border-border-2'}`}
            >
              전체
            </button>
            {units.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${unit === u ? 'bg-accent text-background' : 'bg-surface border border-border text-text-secondary hover:border-border-2'}`}
              >
                {u}
              </button>
            ))}
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 bg-surface border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-text-secondary">아직 게시글이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}

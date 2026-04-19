'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { ArrowLeft, BookOpen, PenLine, Lock, Globe, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProblemSet {
  id: string; title: string; description: string; isPublic: boolean; authorId: string; createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { items: number }
}

export default function GroupSetsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [sets, setSets] = useState<ProblemSet[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    const res = await fetch(`/api/groups/${id}/sets`)
    if (res.ok) { const d = await res.json(); setSets(d.sets) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/groups/${id}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDesc, isPublic: false }),
      })
      if (res.ok) {
        toast.success('문제집이 생성되었습니다')
        setNewTitle(''); setNewDesc(''); setShowCreate(false)
        load()
      } else {
        toast.error((await res.json()).error ?? '오류 발생')
      }
    } finally { setCreating(false) }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/groups/${id}`} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> 그룹으로
        </Link>
        {session?.user && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors">
            <PenLine size={14} /> 문제집 만들기
          </button>
        )}
      </div>

      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
        <BookOpen size={18} className="text-accent" /> 그룹 문제집
      </h1>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">새 문제집</h3>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-muted" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="문제집 제목 *" required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="설명 (선택사항)" rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
              <button type="submit" disabled={creating || !newTitle.trim()}
                className="w-full py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                {creating ? '생성 중...' : '만들기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sets.length > 0 ? (
        <div className="space-y-3">
          {sets.map((s) => (
            <Link key={s.id} href={`/problems/sets/${s.id}`}
              className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all">
              <BookOpen size={20} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-text-primary truncate">{s.title}</span>
                  {s.isPublic ? <Globe size={11} className="text-muted shrink-0" /> : <Lock size={11} className="text-muted shrink-0" />}
                </div>
                {s.description && <p className="text-xs text-text-secondary truncate">{s.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <Avatar name={s.author.name} image={s.author.image} size={14} />
                  <span className="text-xs text-muted">{s.author.name}</span>
                  <TierBadge points={s.author.points} />
                  <span className="text-xs text-muted">{timeAgo(s.createdAt)}</span>
                </div>
              </div>
              <span className="text-xs text-muted shrink-0">{s._count.items}문제</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-text-secondary text-sm">아직 문제집이 없습니다</p>
          {session?.user && (
            <button onClick={() => setShowCreate(true)} className="mt-4 text-accent text-sm hover:underline">
              첫 번째 문제집을 만들어보세요!
            </button>
          )}
        </div>
      )}
    </div>
  )
}

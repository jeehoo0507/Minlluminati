'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { BookOpen, PenLine, ListChecks, ArrowLeft, Lock, Globe } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProblemSet {
  id: string
  title: string
  description: string
  isPublic: boolean
  authorId: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { items: number }
}

export default function ProblemSetsPage() {
  const { data: session } = useSession()
  const [sets, setSets] = useState<ProblemSet[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPublic, setNewPublic] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    const res = await fetch('/api/problems/sets')
    if (res.ok) {
      const data = await res.json()
      setSets(data.sets)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/problems/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDesc, isPublic: newPublic }),
      })
      if (res.ok) {
        toast.success('문제집이 생성되었습니다')
        setShowCreate(false)
        setNewTitle('')
        setNewDesc('')
        setNewPublic(true)
        await load()
      } else {
        const err = await res.json()
        toast.error(err.error ?? '생성 실패')
      }
    } finally { setCreating(false) }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/problems" className="text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-xl font-bold text-text-primary">문제집</h1>
          </div>
          <p className="text-sm text-text-secondary">여러 문제를 묶어 문제집을 만들어보세요</p>
        </div>
        {session?.user && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
          >
            <PenLine size={14} />
            문제집 만들기
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-base font-bold text-text-primary">새 문제집 만들기</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">제목 *</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="문제집 제목"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">설명</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="문제집 설명 (선택사항)"
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPublic}
                  onChange={(e) => setNewPublic(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-text-primary">공개 문제집</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                >
                  {creating ? '생성 중...' : '만들기'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nav shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/problems"
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all"
        >
          <ListChecks size={20} className="text-accent" />
          <div>
            <p className="text-sm font-medium text-text-primary">문제 목록</p>
            <p className="text-xs text-muted">전체 문제 보기</p>
          </div>
        </Link>
        <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/20 rounded-xl">
          <BookOpen size={20} className="text-accent" />
          <div>
            <p className="text-sm font-medium text-text-primary">문제집</p>
            <p className="text-xs text-muted">총 {sets.length}개</p>
          </div>
        </div>
      </div>

      {/* Sets list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sets.length > 0 ? (
        <div className="space-y-3">
          {sets.map((set) => {
            const isOwn = session?.user?.id === set.authorId
            return (
              <Link
                key={set.id}
                href={`/problems/sets/${set.id}`}
                className="flex items-start gap-4 p-4 bg-surface border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <BookOpen size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{set.title}</h3>
                    {set.isPublic
                      ? <Globe size={11} className="text-muted shrink-0" />
                      : <Lock size={11} className="text-muted shrink-0" />
                    }
                    {isOwn && <span className="text-xs text-accent">(내 문제집)</span>}
                  </div>
                  {set.description && (
                    <p className="text-xs text-text-secondary truncate mb-1">{set.description}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Avatar name={set.author.name} image={set.author.image} size={16} />
                      <span className="text-xs text-muted">{set.author.name}</span>
                      <TierBadge points={set.author.points} />
                    </div>
                    <span className="text-xs text-muted">{timeAgo(set.createdAt)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold text-accent">{set._count.items}</div>
                  <div className="text-xs text-muted">문제</div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <BookOpen size={40} className="mx-auto text-muted mb-3" />
          <p className="text-text-secondary">아직 문제집이 없습니다</p>
          {session?.user && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-accent text-sm hover:underline"
            >
              <PenLine size={13} />
              첫 번째 문제집을 만들어보세요!
            </button>
          )}
        </div>
      )}
    </div>
  )
}

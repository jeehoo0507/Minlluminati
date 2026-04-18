'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { ArrowLeft, PenLine, Trash2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface Post { id: string; title: string; content: string; createdAt: string; author: { id: string; name?: string | null; image?: string | null; points: number } }

export default function GroupBoardPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [writing, setWriting] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    const [postsRes, groupRes] = await Promise.all([
      fetch(`/api/groups/${id}/posts`),
      fetch(`/api/groups/${id}`),
    ])
    if (postsRes.ok) setPosts(await postsRes.json())
    if (groupRes.ok) {
      const g = await groupRes.json()
      const myM = g.myMembership
      setIsMember(!!myM)
      setIsAdmin(myM?.role === 'ADMIN' || g.ownerId === session?.user?.id || session?.user?.role === 'ADMIN')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id, session])

  async function handlePost() {
    if (!newTitle.trim() || !newContent.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      })
      if (res.ok) { setNewTitle(''); setNewContent(''); setWriting(false); load() }
      else toast.error((await res.json()).error)
    } finally { setSubmitting(false) }
  }

  async function handleDelete(postId: string) {
    const res = await fetch(`/api/groups/${id}/posts/${postId}`, { method: 'DELETE' })
    if (res.ok) setPosts((p) => p.filter((x) => x.id !== postId))
    else toast.error('삭제 실패')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/groups/${id}`} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> 그룹으로
        </Link>
        {isMember && (
          <button onClick={() => setWriting(!writing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
            <PenLine size={14} /> 글쓰기
          </button>
        )}
      </div>

      {writing && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="제목"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={5} placeholder="내용 (Markdown 지원)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none font-mono" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setWriting(false)} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">취소</button>
            <button onClick={handlePost} disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-text-secondary text-sm">아직 게시글이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="bg-surface border border-border rounded-xl overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-2 transition-colors"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar name={p.author.name} image={p.author.image} size={24} />
                  <span className="text-xs text-text-secondary">{p.author.name}</span>
                  <TierBadge points={p.author.points} />
                  <span className="font-medium text-text-primary truncate ml-2">{p.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted">{timeAgo(p.createdAt)}</span>
                  {(session?.user?.id === p.author.id || isAdmin) && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} className="text-muted hover:text-red-400 transition-colors p-0.5">
                      <Trash2 size={13} />
                    </button>
                  )}
                  <ChevronDown size={14} className={`text-muted transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expandedId === p.id && (
                <div className="px-4 pb-4 pt-1 border-t border-border prose-content text-sm">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{p.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

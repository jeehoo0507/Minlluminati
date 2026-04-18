'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { Trash2, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface Comment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
}

export function CommentSection({ postId }: { postId: string }) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await fetch(`/api/posts/${postId}/comments`)
    if (res.ok) setComments(await res.json())
  }

  useEffect(() => { load() }, [postId])

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const c = await res.json()
        setComments((p) => [...p, c])
        setText('')
      } else {
        toast.error('댓글 등록 실패')
      }
    } finally {
      setLoading(false)
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: id }),
    })
    if (res.ok) setComments((p) => p.filter((c) => c.id !== id))
    else toast.error('삭제 실패')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-secondary">댓글 {comments.length}개</h3>

      {/* Comment list */}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author.name} image={c.author.image} size={28} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text-primary">{c.author.name}</span>
                <TierBadge points={c.author.points} />
                <span className="text-xs text-muted ml-auto">{timeAgo(c.createdAt)}</span>
                {(session?.user?.id === c.author.id || session?.user?.role === 'ADMIN') && (
                  <button onClick={() => deleteComment(c.id)} className="text-muted hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="prose-dark text-sm bg-surface-2 rounded-lg px-3 py-2 border border-border">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {c.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-muted text-center py-4">아직 댓글이 없습니다</p>
        )}
      </div>

      {/* Input */}
      {session?.user ? (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Avatar name={session.user.name} image={session.user.image} size={28} />
          <div className="flex-1 flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submit() }}
              placeholder="댓글을 입력하세요 (Ctrl+Enter로 등록)"
              rows={2}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-none"
            />
            <button
              onClick={submit}
              disabled={loading || !text.trim()}
              className="self-end px-3 py-2 rounded-lg bg-accent text-background hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted text-center py-2 border-t border-border">
          댓글을 작성하려면 로그인하세요
        </p>
      )}
    </div>
  )
}

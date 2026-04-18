'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { Trash2, Send, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

interface Comment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
}

export function CommentSection({ postId }: { postId: string }) {
  const { data: session } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function load() {
    const res = await fetch(`/api/posts/${postId}/comments`)
    if (res.ok) setComments(await res.json())
  }

  useEffect(() => { load() }, [postId])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const data = await res.json()
      setText((t) => t + `\n![${file.name}](${data.url})\n`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    e.preventDefault()
    setUploading(true)
    try {
      for (const file of imageFiles) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) continue
        const data = await res.json()
        setText((t) => t + `\n![image](${data.url})\n`)
      }
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) { const c = await res.json(); setComments((p) => [...p, c]); setText('') }
      else toast.error('댓글 등록 실패')
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
              <div className="prose-content text-sm bg-surface-2 rounded-lg px-3 py-2 border border-border">
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

      {session?.user ? (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Avatar name={session.user.name} image={session.user.image} size={28} />
          <div className="flex-1 space-y-1.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submit() }}
              placeholder="댓글 입력 (Ctrl+Enter 등록, Ctrl+V 이미지 붙여넣기)"
              rows={2}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-none"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs text-muted hover:text-text-secondary transition-colors"
              >
                <ImageIcon size={13} />
                {uploading ? '업로드 중...' : '이미지 첨부'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <button
                onClick={submit}
                disabled={loading || !text.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-dim transition-colors disabled:opacity-50"
              >
                <Send size={12} />
                등록
              </button>
            </div>
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

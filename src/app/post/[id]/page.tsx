'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { CommentSection } from '@/components/comment/CommentSection'
import { SUBJECTS, timeAgo, parseJsonSafe, type SubjectKey } from '@/lib/utils'
import { Heart, Trash2, ArrowLeft, FileText, Pencil } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const TYPE_LABELS: Record<string, string> = {
  PROBLEM: '문제', QUESTION: '질문', FREE: '자유', SOLUTION: '풀이',
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()

  const [post, setPost] = useState<{
    id: string; title: string; content: string; subject: string; unit?: string | null
    type: string; createdAt: string; imageUrls: string; fileUrls: string
    author: { id: string; name?: string | null; image?: string | null; points: number; role: string }
    _count: { likes: number; comments: number }
  } | null>(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/posts/${id}`).then((r) => r.json()),
      fetch(`/api/posts/${id}/like`).then((r) => r.json()),
    ]).then(([p, l]) => {
      setPost(p)
      setLiked(l.liked)
      setLikeCount(l.count)
    }).finally(() => setLoading(false))
  }, [id])

  async function handleLike() {
    if (!session?.user) { toast.error('로그인이 필요합니다'); return }
    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setLiked(data.liked)
      setLikeCount(data.count)
      if (data.liked) toast.success('+2pt 추천!')
    }
  }

  async function handleDelete() {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('삭제되었습니다'); router.push('/feed') }
    else toast.error('삭제 실패')
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />)}
    </div>
  )

  if (!post) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-text-secondary">게시글을 찾을 수 없습니다</p>
      <Link href="/feed" className="mt-4 inline-block text-accent text-sm hover:underline">피드로 돌아가기</Link>
    </div>
  )

  const subjectInfo = SUBJECTS[post.subject as SubjectKey]
  const fileUrls = parseJsonSafe<string[]>(post.fileUrls, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        피드로
      </Link>

      {/* Post */}
      <article className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {subjectInfo && (
            <span className="text-xs px-2 py-0.5 rounded-md border border-border text-text-secondary">
              {subjectInfo.label}
            </span>
          )}
          {post.unit && <span className="text-xs text-muted">· {post.unit}</span>}
          <span className="text-xs px-2 py-0.5 rounded-md border border-border-2 text-text-secondary">
            {TYPE_LABELS[post.type] ?? post.type}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-text-primary">{post.title}</h1>

        {/* Author */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Avatar name={post.author.name} image={post.author.image} size={32} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{post.author.name}</span>
                <TierBadge points={post.author.points} showPoints />
              </div>
              <span className="text-xs text-muted">{timeAgo(post.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {session?.user?.id === post.author.id && (
              <Link href={`/post/${id}/edit`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-accent hover:bg-accent/5 border border-transparent hover:border-accent/20 transition-all">
                <Pencil size={13} /> 수정
              </Link>
            )}
            {(session?.user?.id === post.author.id || session?.user?.role === 'ADMIN') && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-red-400 hover:bg-red-400/5 border border-transparent hover:border-red-400/20 transition-all">
                <Trash2 size={13} />
                {session?.user?.role === 'ADMIN' && session?.user?.id !== post.author.id ? '관리자 삭제' : '삭제'}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="prose-content">
          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
            {post.content}
          </ReactMarkdown>
        </div>

        {/* Files */}
        {fileUrls.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs font-medium text-text-secondary mb-2">첨부 파일</p>
            <div className="flex flex-wrap gap-2">
              {fileUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
                  <FileText size={12} />
                  {url.split('/').pop()}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Like */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              liked
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'border-border text-text-secondary hover:border-border-2 hover:text-text-primary'
            }`}
          >
            <Heart size={15} className={liked ? 'fill-current' : ''} />
            <span className="text-sm font-medium">{likeCount}</span>
            <span className="text-xs">{liked ? '추천 취소' : '추천 (+2pt)'}</span>
          </button>
        </div>
      </article>

      {/* Comments */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <CommentSection postId={id} />
      </div>
    </div>
  )
}

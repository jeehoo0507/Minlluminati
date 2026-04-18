'use client'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { SUBJECTS, cn, timeAgo, type SubjectKey } from '@/lib/utils'
import { Heart, MessageCircle, ChevronRight } from 'lucide-react'

interface PostCardProps {
  post: {
    id: string
    title: string
    content: string
    subject: string
    unit?: string | null
    type: string
    createdAt: string | Date
    author: { id: string; name?: string | null; image?: string | null; points: number }
    _count: { likes: number; comments: number }
  }
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PROBLEM:  { label: '문제', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  QUESTION: { label: '질문', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  FREE:     { label: '자유', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  SOLUTION: { label: '풀이', color: 'text-accent bg-accent/10 border-accent/20' },
}

export function PostCard({ post }: PostCardProps) {
  const subjectInfo = SUBJECTS[post.subject as SubjectKey]
  const typeInfo = TYPE_LABELS[post.type] ?? TYPE_LABELS.FREE
  const preview = post.content.replace(/\$\$[\s\S]*?\$\$/g, '[수식]').replace(/\$[^$]*\$/g, '[수식]').replace(/[#*`>]/g, '').slice(0, 120)

  return (
    <Link href={`/post/${post.id}`} className="block group">
      <article className="p-4 bg-surface border border-border rounded-xl hover:border-border-2 transition-all duration-200 hover:bg-surface-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {subjectInfo && (
              <span className="text-xs px-2 py-0.5 rounded-md border border-border text-text-secondary">
                {subjectInfo.short}
              </span>
            )}
            {post.unit && (
              <span className="text-xs text-muted">· {post.unit}</span>
            )}
            <span className={cn('text-xs px-2 py-0.5 rounded-md border', typeInfo.color)}>
              {typeInfo.label}
            </span>
          </div>
          <ChevronRight size={16} className="text-muted shrink-0 mt-0.5 group-hover:text-text-secondary transition-colors" />
        </div>

        {/* Title */}
        <h2 className="font-semibold text-text-primary mb-1.5 line-clamp-2 group-hover:text-accent transition-colors">
          {post.title}
        </h2>

        {/* Preview */}
        <p className="text-sm text-text-secondary line-clamp-2 mb-3">{preview}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar name={post.author.name} image={post.author.image} size={22} />
            <span className="text-xs text-text-secondary font-medium">{post.author.name}</span>
            <TierBadge points={post.author.points} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Heart size={12} />
              {post._count.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              {post._count.comments}
            </span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

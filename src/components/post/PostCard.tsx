'use client'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { SUBJECTS, cn, timeAgo, type SubjectKey } from '@/lib/utils'
import { Heart, MessageCircle, ChevronRight, Pin, PinOff } from 'lucide-react'

interface PostCardProps {
  post: {
    id: string
    postNumber?: number | null
    title: string
    content: string
    subject: string
    unit?: string | null
    type: string
    pinned?: boolean
    createdAt: string | Date
    author: { id: string; name?: string | null; image?: string | null; points: number }
    _count: { likes: number; comments: number }
  }
  canPin?: boolean
  onPinToggle?: (postId: string, pinned: boolean) => void
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PROBLEM:  { label: '문제', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  QUESTION: { label: '질문', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  FREE:     { label: '자유', color: 'text-violet-700 bg-violet-50 border-violet-200' },
  SOLUTION: { label: '풀이', color: 'text-green-700 bg-green-50 border-green-200' },
}

export function PostCard({ post, canPin, onPinToggle }: PostCardProps) {
  const subjectInfo = SUBJECTS[post.subject as SubjectKey]
  const typeInfo = TYPE_LABELS[post.type] ?? TYPE_LABELS.FREE
  const preview = post.content
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '[수식]')
    .replace(/\$[^$]*\$/g, '[수식]')
    .replace(/[#*`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return (
    <div className="relative group">
      <Link href={`/post/${post.postNumber ?? post.id}`} className="block">
        <article className={cn(
          'p-4 bg-surface border rounded-xl hover:border-border-2 transition-all duration-200 hover:bg-surface-2',
          post.pinned ? 'border-accent/40 bg-accent/5 hover:bg-accent/10' : 'border-border',
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {post.pinned && (
                <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                  <Pin size={11} className="fill-accent" /> 고정
                </span>
              )}
              {post.postNumber != null && (
                <span className="text-xs font-mono font-semibold text-accent">#{post.postNumber}</span>
              )}
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

      {/* Pin button — visible on hover for ADMIN/OWNER */}
      {canPin && onPinToggle && (
        <button
          onClick={(e) => { e.preventDefault(); onPinToggle(post.id, !post.pinned) }}
          title={post.pinned ? '고정 해제' : '상단 고정'}
          className={cn(
            'absolute top-3 right-8 opacity-0 group-hover:opacity-100 transition-opacity z-10',
            'p-1.5 rounded-lg text-xs',
            post.pinned
              ? 'text-accent bg-accent/10 hover:bg-accent/20'
              : 'text-muted bg-surface-2 hover:text-accent hover:bg-accent/10',
          )}
        >
          {post.pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      )}
    </div>
  )
}

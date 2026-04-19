'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { ArrowLeft, FileText, MessageSquare, Trophy } from 'lucide-react'

interface UserProfile {
  id: string
  name?: string | null
  image?: string | null
  points: number
  role: string
  createdAt: string
  _count: { posts: number; comments: number }
  posts: { id: string; title: string; createdAt: string }[]
  streakMap: Record<string, number>
  subjectCount: Record<string, number>
  rivals: { id: string; name?: string | null; image?: string | null; points: number }[]
  contestWins?: number
}

const SUBJECT_LABELS: Record<string, string> = {
  MATH1: '공통수학1', MATH2: '공통수학2', PROOF: '증명', PHYSICS: '물리', CHEMISTRY: '화학',
  EARTH: '지구과학', CS: '정보', FREE: '자유', QUESTION: '질문', BOARD: '공지',
}

function StreakGrid({ streakMap }: { streakMap: Record<string, number> }) {
  const today = new Date()
  const cells: { date: string; count: number }[] = []
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, count: streakMap[key] ?? 0 })
  }
  // Pad to start on Sunday
  const firstDay = new Date(cells[0].date).getDay()
  const padded = [...Array(firstDay).fill(null), ...cells]

  const color = (n: number) => n === 0 ? 'bg-surface-2' : n === 1 ? 'bg-green-300' : 'bg-green-500'

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-rows-7 grid-flow-col gap-0.5 w-fit">
        {padded.map((cell, i) =>
          cell === null
            ? <div key={`pad-${i}`} className="w-3 h-3" />
            : <div key={cell.date} title={`${cell.date}: ${cell.count}개`}
                className={`w-3 h-3 rounded-sm ${color(cell.count)}`} />
        )}
      </div>
    </div>
  )
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setUser(d); setLoading(false) })
  }, [id])

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><div className="h-48 bg-surface border border-border rounded-2xl animate-pulse" /></div>
  if (!user) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-text-secondary">사용자를 찾을 수 없습니다</div>

  const topSubjects = Object.entries(user.subjectCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const totalActivity = Object.values(user.streakMap).reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} /> 뒤로
      </Link>

      {/* Profile card */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <Avatar name={user.name} image={user.image} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-text-primary">{user.name ?? '익명'}</h1>
              {user.role === 'ADMIN' && (
                <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium">관리자</span>
              )}
            </div>
            <div className="mt-1">
              <TierBadge points={user.points} showPoints />
            </div>
            <p className="text-xs text-muted mt-1">{new Date(user.createdAt).toLocaleDateString('ko-KR')} 가입</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-0.5">
              <FileText size={13} />
              <span className="text-xs">게시글</span>
            </div>
            <p className="text-lg font-bold text-text-primary">{user._count.posts}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-0.5">
              <MessageSquare size={13} />
              <span className="text-xs">댓글</span>
            </div>
            <p className="text-lg font-bold text-text-primary">{user._count.comments}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-0.5">
              <Trophy size={13} />
              <span className="text-xs">활동일</span>
            </div>
            <p className="text-lg font-bold text-text-primary">{totalActivity}</p>
          </div>
        </div>
      </div>

      {/* Streak */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">활동 스트릭 (최근 1년)</h2>
        <StreakGrid streakMap={user.streakMap} />
        <div className="flex items-center gap-2 mt-2 text-xs text-muted">
          <span>적음</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-surface-2" />
            <div className="w-3 h-3 rounded-sm bg-green-300" />
            <div className="w-3 h-3 rounded-sm bg-green-500" />
          </div>
          <span>많음</span>
        </div>
      </div>

      {/* Subject breakdown */}
      {topSubjects.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">주요 활동 과목</h2>
          <div className="flex flex-wrap gap-2">
            {topSubjects.map(([key, count]) => (
              <span key={key} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border rounded-full text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{SUBJECT_LABELS[key] ?? key}</span>
                <span className="text-muted">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent posts */}
      {user.posts.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">최근 게시글</h2>
          <div className="space-y-2">
            {user.posts.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/post/${p.id}`}
                className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:text-accent transition-colors group">
                <span className="text-sm text-text-primary group-hover:text-accent truncate">{p.title}</span>
                <span className="text-xs text-muted ml-3 shrink-0">{timeAgo(p.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Rivals */}
      {user.rivals.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">라이벌</h2>
          <div className="flex flex-wrap gap-3">
            {user.rivals.map((r) => (
              <Link key={r.id} href={`/users/${r.id}`} className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-xl hover:border-accent/40 transition-colors">
                <Avatar name={r.name} image={r.image} size={24} />
                <div>
                  <p className="text-xs font-medium text-text-primary">{r.name}</p>
                  <TierBadge points={r.points} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

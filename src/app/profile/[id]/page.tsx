'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { StreakChart } from '@/components/ui/StreakChart'
import { PointLineChart } from '@/components/ui/PointLineChart'
import { RadarChart } from '@/components/ui/RadarChart'
import { SUBJECTS } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'
import { UserPlus, UserMinus, FileText, MessageSquare, Trophy } from 'lucide-react'
import { getTier } from '@/lib/scoring'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string; name?: string | null; image?: string | null
  points: number; role: string; createdAt: string
  _count: { posts: number; comments: number }
  posts: { id: string; subject: string; pointsAwarded: number; createdAt: string }[]
  subjectCount: Record<string, number>
  streakMap: Record<string, number>
  pointTimeline: { month: string; points: number }[]
  radarData: { label: string; value: number }[]
  isRival: boolean
  rivals: { id: string; name?: string | null; image?: string | null; points: number }[]
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [rivalLoading, setRivalLoading] = useState(false)

  async function load() {
    const res = await fetch(`/api/users/${id}`)
    if (res.ok) setProfile(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id, session])

  async function toggleRival() {
    if (!profile) return
    setRivalLoading(true)
    try {
      if (profile.isRival) {
        await fetch('/api/rivals', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rivalId: id }),
        })
        toast.success('라이벌 해제')
      } else {
        const res = await fetch('/api/rivals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rivalId: id }),
        })
        if (!res.ok) { toast.error((await res.json()).error); return }
        toast.success('라이벌 등록!')
      }
      await load()
    } finally { setRivalLoading(false) }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8"><div className="h-48 bg-surface border border-border rounded-2xl animate-pulse" /></div>
  if (!profile) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-text-secondary">유저를 찾을 수 없습니다</div>

  const tier = getTier(profile.points)
  const isMe = session?.user?.id === id
  const subjectEntries = Object.entries(profile.subjectCount).sort((a, b) => b[1] - a[1])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      {/* Profile card */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <Avatar name={profile.name} image={profile.image} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-text-primary">{profile.name ?? '?'}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <TierBadge points={profile.points} />
                  <span className="text-sm font-semibold" style={{ color: tier.color }}>{tier.name}</span>
                  <span className="text-sm text-muted">· {profile.points.toLocaleString()}pt</span>
                </div>
              </div>
              {session?.user && !isMe && (
                <button onClick={toggleRival} disabled={rivalLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    profile.isRival
                      ? 'border border-border text-text-secondary hover:text-red-400 hover:border-red-300'
                      : 'bg-accent text-white hover:bg-accent-dim'
                  }`}
                >
                  {profile.isRival ? <><UserMinus size={13} /> 라이벌 해제</> : <><UserPlus size={13} /> 라이벌 등록</>}
                </button>
              )}
              {isMe && (
                <Link href="/profile" className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
                  프로필 편집
                </Link>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span className="flex items-center gap-1"><FileText size={11} />{profile._count.posts}개 작성</span>
              <span className="flex items-center gap-1"><MessageSquare size={11} />{profile._count.comments}개 댓글</span>
              <span>{timeAgo(profile.createdAt)} 가입</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity charts */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-text-secondary">활동 분석</h2>

        {/* Streak */}
        <StreakChart streakMap={profile.streakMap} />

        {/* Point line chart */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-text-secondary mb-2 font-medium">포인트 변화</p>
          <PointLineChart data={profile.pointTimeline} />
        </div>

        {/* Radar */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-text-secondary mb-2 font-medium">기여 분야</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-48 shrink-0">
              <RadarChart data={profile.radarData} />
            </div>
            {subjectEntries.length > 0 && (
              <div className="flex-1 w-full space-y-1.5">
                {subjectEntries.map(([key, count]) => {
                  const subj = SUBJECTS[key as keyof typeof SUBJECTS]
                  const max = subjectEntries[0][1]
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary w-20 shrink-0">{subj?.label ?? key}</span>
                      <div className="flex-1 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Recent posts */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-secondary mb-3">최근 작성글</h2>
          {profile.posts.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">작성한 글이 없습니다</p>
          ) : (
            <div className="space-y-1.5">
              {profile.posts.slice(0, 10).map((p) => (
                <Link key={p.id} href={`/post/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 transition-colors">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded shrink-0">
                      {SUBJECTS[p.subject as keyof typeof SUBJECTS]?.short ?? p.subject}
                    </span>
                    <span className="text-xs text-muted truncate">{timeAgo(p.createdAt)}</span>
                  </div>
                  {p.pointsAwarded > 0 && (
                    <span className="text-xs text-emerald-500 shrink-0 ml-2">+{p.pointsAwarded}pt</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Rivals */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
            <Trophy size={13} className="text-accent" /> 라이벌
          </h2>
          {profile.rivals.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">등록된 라이벌이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {profile.rivals.map((r) => (
                <Link key={r.id} href={`/profile/${r.id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors">
                  <Avatar name={r.name} image={r.image} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-primary truncate block">{r.name ?? '?'}</span>
                    <TierBadge points={r.points} />
                  </div>
                  <span className="text-xs text-accent">{r.points}pt</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

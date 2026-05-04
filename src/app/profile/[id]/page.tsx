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
import { UserPlus, UserMinus, FileText, MessageSquare, Trophy, Bookmark } from 'lucide-react'
import { getTier } from '@/lib/scoring'
import toast from 'react-hot-toast'

interface BannerItem { id: string; name: string; imageUrl: string; size: string }
interface BadgeInfo { id: string; key: string; name: string; imageUrl: string | null; title: string | null; isHidden: boolean }
interface UserProfile {
  id: string; name?: string | null; image?: string | null
  points: number; role: string; createdAt: string
  _count: { posts: number; comments: number }
  posts: { id: string; subject: string; pointsAwarded: number; createdAt: string }[]
  subjectCount: Record<string, number>
  streakMap: Record<string, number>
  pointTimeline: { date: string; points: number }[] // kept for compat, not used directly
  radarData: { label: string; value: number }[]
  solvedProblems: { id: string; problemNumber: number; title: string; subject: string | null }[]
  bookmarkedProblems: { id: string; problemNumber: number; title: string; subject: string | null; approvedPts: number | null }[]
  isRival: boolean
  isMaster: boolean
  isFirstRuby: boolean
  rivals: { id: string; name?: string | null; image?: string | null; points: number }[]
  equippedBanner: BannerItem | null
  selectedBadges: BadgeInfo[]
  titleBadge: BadgeInfo | null
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [rivalLoading, setRivalLoading] = useState(false)
  const [streakYear, setStreakYear] = useState(new Date().getFullYear())
  const [streakData, setStreakData] = useState<{ streakMap: Record<string, number>; streak: number; shieldMap?: Record<string, boolean> } | null>(null)
  const [pointYear, setPointYear] = useState(new Date().getFullYear())
  const [pointData, setPointData] = useState<{ date: string; points: number }[]>([])

  async function load() {
    const res = await fetch(`/api/users/${id}`)
    if (res.ok) setProfile(await res.json())
    setLoading(false)
  }

  async function loadStreak(userId: string, year: number) {
    const res = await fetch(`/api/users/${userId}/streak?year=${year}`)
    if (res.ok) setStreakData(await res.json())
  }

  async function loadPoints(userId: string, year: number) {
    const res = await fetch(`/api/users/${userId}/points?year=${year}`)
    if (res.ok) { const d = await res.json(); setPointData(d.timeline) }
  }

  useEffect(() => { load() }, [id, session])
  useEffect(() => { if (id) { loadStreak(id, streakYear); loadPoints(id, pointYear) } }, [id])

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
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {/* Equipped banner */}
        {profile.equippedBanner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.equippedBanner.imageUrl} alt={profile.equippedBanner.name}
            className={`w-full object-cover ${profile.equippedBanner.size === 'sm' ? 'h-24' : profile.equippedBanner.size === 'lg' ? 'h-56' : 'h-40'}`} />
        )}
        <div className="p-6">
        <div className="flex items-start gap-4">
          <Avatar name={profile.name} image={profile.image} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-text-primary">{profile.name ?? '?'}</h1>
                  {/* 칭호: 선택된 title 뱃지 우선, 없으면 isFirstRuby fallback */}
                  {profile.titleBadge?.title ? (
                    <span className="text-xs font-medium italic" style={{ color: '#9ca3af' }}>{profile.titleBadge.title}</span>
                  ) : profile.isFirstRuby && (
                    <span className="text-xs font-medium italic" style={{ color: '#9ca3af' }}>first ruby</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <TierBadge points={profile.points} isMaster={profile.isMaster} />
                  <span className="text-sm font-semibold" style={{ color: profile.isMaster ? '#f59e0b' : tier.color }}>
                    {profile.isMaster ? '마스터' : tier.name}
                  </span>
                  <span className="text-sm text-muted">· {profile.points.toLocaleString()}pt</span>
                </div>
              </div>
              {session?.user && !isMe && (
                <button onClick={toggleRival} disabled={rivalLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    profile.isRival
                      ? 'border border-border text-text-secondary hover:text-red-400 hover:border-red-300'
                      : 'bg-accent text-white hover:bg-accent-dim'
                  }`}
                >
                  {profile.isRival ? <><UserMinus size={13} /> 라이벌 해제</> : <><UserPlus size={13} /> 라이벌 등록</>}
                </button>
              )}
              {isMe && (
                <Link href="/profile" className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap shrink-0">
                  프로필 편집
                </Link>
              )}
            </div>
            {/* 선택된 뱃지 */}
            {profile.selectedBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.selectedBadges.map((b) => (
                  <div key={b.id} title={b.name} className="group relative">
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt={b.name} className="w-7 h-7 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                        {b.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 bg-surface border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary whitespace-nowrap shadow-lg">
                      {b.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span className="flex items-center gap-1"><FileText size={11} />{profile._count.posts}개 작성</span>
              <span className="flex items-center gap-1"><MessageSquare size={11} />{profile._count.comments}개 댓글</span>
              <span>{timeAgo(profile.createdAt)} 가입</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Activity charts */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-text-secondary">활동 분석</h2>

        {/* Streak */}
        <StreakChart
          streakMap={streakData?.streakMap ?? profile.streakMap ?? {}}
          year={streakYear}
          streak={streakData?.streak ?? 0}
          shieldMap={streakData?.shieldMap ?? {}}
          onYearChange={(y) => { setStreakYear(y); loadStreak(id, y) }}
        />

        {/* Point line chart */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-text-secondary mb-2 font-medium">포인트 변화</p>
          <PointLineChart
            data={pointData}
            year={pointYear}
            onYearChange={(y) => { setPointYear(y); loadPoints(id, y) }}
          />
        </div>

        {/* Solved problems + Bookmarks */}
        <div className="border-t border-border pt-4 space-y-3">
          {/* 푼 문제 */}
          <p className="text-xs text-text-secondary font-medium">
            푼 문제 <span className="text-muted font-normal">({profile.solvedProblems.length})</span>
          </p>
          {profile.solvedProblems.length === 0 ? (
            <p className="text-xs text-muted py-1">아직 푼 문제가 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {profile.solvedProblems.map((p) => (
                <Link key={p.id} href={`/problems/${p.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
                  <span className="font-mono font-semibold">#{p.problemNumber}</span>
                  <span className="text-emerald-400/80 truncate max-w-[120px]">{p.title}</span>
                </Link>
              ))}
            </div>
          )}

          {/* 북마크 (본인만) */}
          {session?.user?.id === id && (
            <>
              <p className="text-xs text-text-secondary font-medium pt-2 border-t border-border/50 flex items-center gap-1.5">
                <Bookmark size={11} className="text-amber-500" />
                저장한 문제 <span className="text-muted font-normal">({profile.bookmarkedProblems?.length ?? 0})</span>
              </p>
              {(profile.bookmarkedProblems?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted py-1">저장한 문제가 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.bookmarkedProblems.map((p) => (
                    <Link key={p.id} href={`/problems/${p.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors border border-amber-500/20">
                      <Bookmark size={9} className="fill-amber-500 text-amber-500" />
                      <span className="font-mono font-semibold">#{p.problemNumber}</span>
                      <span className="text-amber-500/80 truncate max-w-[120px]">{p.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
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

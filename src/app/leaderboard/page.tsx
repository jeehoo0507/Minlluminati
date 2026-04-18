'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { getTier } from '@/lib/scoring'
import { useSession } from 'next-auth/react'
import { TIERS } from '@/lib/scoring'
import { FileText } from 'lucide-react'

interface LeaderUser {
  id: string
  name?: string | null
  image?: string | null
  points: number
  role: string
  _count: { posts: number }
}

const RANK_STYLES = [
  'text-yellow-700 bg-yellow-50 border-yellow-300',
  'text-gray-600 bg-gray-100 border-gray-300',
  'text-orange-700 bg-orange-50 border-orange-300',
]

export default function LeaderboardPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<LeaderUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  const myRank = session?.user ? users.findIndex((u) => u.id === session.user.id) + 1 : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">랭킹</h1>
        <p className="text-sm text-text-secondary mt-1">문제를 올리고 추천을 받아 티어를 올려보세요</p>
      </div>

      {/* Tier guide */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {TIERS.map((t) => (
          <div key={t.name} className="text-center p-2 border border-border rounded-lg" style={{ background: t.bg }}>
            <div className="text-xs font-semibold mt-0.5" style={{ color: t.color }}>{t.name}</div>
            <div className="text-xs text-muted">{t.max === Infinity ? `${t.min}+` : `${t.min}~${t.max}`}pt</div>
          </div>
        ))}
      </div>

      {/* My rank */}
      {myRank > 0 && (
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg text-sm text-center text-accent">
          내 순위: <strong>{myRank}위</strong> · {session?.user?.points ?? 0}pt · {getTier(session?.user?.points ?? 0).name}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user, idx) => {
            const rank = idx + 1
            const isMe = session?.user?.id === user.id
            return (
              <Link
                key={user.id}
                href={`/profile/${user.id}`}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isMe ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface hover:border-border-2 hover:bg-surface-2'
                }`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shrink-0 border ${rank <= 3 ? RANK_STYLES[rank - 1] : 'text-muted border-transparent'}`}>
                  {rank}
                </div>

                <Avatar name={user.name} image={user.image} size={32} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{user.name ?? '?'}</span>
                    {isMe && <span className="text-xs text-accent">(나)</span>}
                    <TierBadge points={user.points} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <FileText size={11} />
                      {user._count.posts}개 작성
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-accent">{user.points}pt</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

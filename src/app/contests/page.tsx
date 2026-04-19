'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgo } from '@/lib/utils'
import { Plus, Trophy, Clock, Users } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED: { label: '참가 신청', color: 'text-green-700 bg-green-50 border-green-200' },
  ONGOING:  { label: '진행 중',  color: 'text-blue-700 bg-blue-50 border-blue-200' },
  ENDED:    { label: '종료',     color: 'text-gray-500 bg-gray-100 border-gray-200' },
}

interface Contest {
  id: string; title: string; description: string; status: string; durationMin: number
  startTime: string | null; createdAt: string
  organizer: { id: string; name?: string | null; image?: string | null }
  _count: { participants: number; problems: number }
}

export default function ContestsPage() {
  const { data: session } = useSession()
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [canCreate, setCanCreate] = useState(false)

  useEffect(() => {
    fetch('/api/contests').then((r) => r.json()).then(setContests).finally(() => setLoading(false))
    if (session?.user) {
      fetch('/api/me/organizer-status').then((r) => r.json()).then((d) => {
        if (d.canCreate) setCanCreate(true)
      }).catch(() => {})
    }
  }, [session])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Trophy size={22} className="text-accent" /> 대회
          </h1>
          <p className="text-sm text-text-secondary mt-1">문제풀이 대회에 참가하세요</p>
        </div>
        {canCreate && (
          <Link href="/contests/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
            <Plus size={15} /> 대회 만들기
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-surface border border-border rounded-xl animate-pulse" />)}</div>
      ) : contests.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">아직 대회가 없습니다</div>
      ) : (
        <div className="space-y-3">
          {contests.map((c) => {
            const st = STATUS_LABELS[c.status] ?? STATUS_LABELS.ENDED
            return (
              <Link key={c.id} href={`/contests/${c.id}`} className="block group">
                <div className="p-5 bg-surface border border-border rounded-xl hover:border-border-2 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${st.color}`}>{st.label}</span>
                        <span className="text-xs text-muted flex items-center gap-1"><Clock size={11} />{c.durationMin}분</span>
                        <span className="text-xs text-muted flex items-center gap-1"><Users size={11} />{c._count.participants}명</span>
                      </div>
                      <h2 className="font-semibold text-text-primary group-hover:text-accent transition-colors">{c.title}</h2>
                      <p className="text-sm text-text-secondary mt-1 line-clamp-1">{c.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-accent">{c._count.problems}문제</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <Avatar name={c.organizer.name} image={c.organizer.image} size={20} />
                    <span className="text-xs text-text-secondary">{c.organizer.name}</span>
                    <span className="text-xs text-muted ml-auto">{timeAgo(c.createdAt)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

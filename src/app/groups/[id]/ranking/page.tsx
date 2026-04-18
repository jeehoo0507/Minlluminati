'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ArrowLeft, Trophy } from 'lucide-react'

interface Member {
  id: string
  role: string
  user: { id: string; name?: string | null; image?: string | null; points: number; role: string }
}

export default function GroupRankingPage() {
  const { id } = useParams<{ id: string }>()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/groups/${id}/ranking`)
      .then((r) => r.json())
      .then((d) => { setMembers(d); setLoading(false) })
  }, [id])

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/groups/${id}`} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> 그룹으로
        </Link>
        <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Trophy size={14} className="text-accent" /> 랭킹
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
              <div className="w-8 text-center">
                {i < 3 ? (
                  <Trophy size={16} className={medalColors[i]} />
                ) : (
                  <span className="text-sm font-semibold text-muted">{i + 1}</span>
                )}
              </div>
              <Avatar name={m.user.name} image={m.user.image} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text-primary truncate">{m.user.name ?? '?'}</span>
                  {m.role === 'ADMIN' && (
                    <span className="text-xs px-1 bg-accent/10 text-accent rounded">운영</span>
                  )}
                  {m.user.role === 'ADMIN' && (
                    <span className="text-xs px-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded">관리자</span>
                  )}
                </div>
                <TierBadge points={m.user.points} />
              </div>
              <div className="text-sm font-semibold text-accent shrink-0">
                {m.user.points.toLocaleString()}p
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="text-center py-12 text-text-secondary text-sm">멤버가 없습니다</div>
          )}
        </div>
      )}
    </div>
  )
}

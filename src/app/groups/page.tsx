'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgo } from '@/lib/utils'
import { Plus, Users, Lock, Globe } from 'lucide-react'

interface Group {
  id: string; name: string; description: string; isPublic: boolean; avatar?: string | null; createdAt: string
  owner: { id: string; name?: string | null; image?: string | null }
  _count: { members: number; posts: number }
}

export default function GroupsPage() {
  const { data: session } = useSession()
  const [groups, setGroups] = useState<Group[]>([])
  const [myGroupIds, setMyGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      setGroups(d.groups ?? [])
      setMyGroupIds(d.myGroupIds ?? [])
    }).finally(() => setLoading(false))
  }, [session])

  const myGroups = groups.filter((g) => myGroupIds.includes(g.id))
  const otherGroups = groups.filter((g) => !myGroupIds.includes(g.id))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Users size={22} className="text-accent" /> 그룹</h1>
          <p className="text-sm text-text-secondary mt-1">그룹에 가입하거나 만들어보세요</p>
        </div>
        {session?.user && (
          <Link href="/groups/new" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
            <Plus size={15} /> 그룹 만들기
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          {myGroups.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-secondary mb-3">내 그룹</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myGroups.map((g) => <GroupCard key={g.id} group={g} isMember />)}
              </div>
            </section>
          )}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">전체 그룹 ({otherGroups.length})</h2>
            {otherGroups.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-sm">그룹이 없습니다</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherGroups.map((g) => <GroupCard key={g.id} group={g} isMember={false} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function GroupCard({ group, isMember }: { group: Group; isMember: boolean }) {
  return (
    <Link href={`/groups/${group.id}`} className="block group">
      <div className="p-4 bg-surface border border-border rounded-xl hover:border-border-2 transition-all h-full">
        <div className="flex items-start gap-3">
          {group.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.avatar} alt={group.name} className="w-12 h-12 rounded-xl object-cover border border-border" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-lg">
              {group.name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-text-primary group-hover:text-accent transition-colors truncate">{group.name}</h3>
              {!group.isPublic ? <Lock size={12} className="text-muted shrink-0" /> : <Globe size={12} className="text-muted shrink-0" />}
              {isMember && <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium shrink-0">가입</span>}
            </div>
            <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{group.description || '설명 없음'}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted">
              <span className="flex items-center gap-1"><Users size={11} />{group._count.members}명</span>
              <span>{group._count.posts}개 글</span>
              <span>{timeAgo(group.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

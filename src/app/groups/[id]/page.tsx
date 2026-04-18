'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { MessageSquare, Trophy, FileText, Settings, UserMinus, UserPlus, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

interface Member { id: string; role: string; joinedAt: string; user: { id: string; name?: string | null; image?: string | null; points: number } }
interface Group {
  id: string; name: string; description: string; avatar?: string | null; isPublic: boolean; ownerId: string
  owner: { id: string; name?: string | null; image?: string | null; points: number }
  members: Member[]; _count: { posts: number; messages: number }
  myMembership: { role: string } | null
}

export default function GroupPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState('')
  const [uploading, setUploading] = useState(false)

  async function load() {
    const res = await fetch(`/api/groups/${id}`)
    if (res.ok) { const d = await res.json(); setGroup(d); setDesc(d.description) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleJoin() {
    const res = await fetch(`/api/groups/${id}/join`, { method: 'POST' })
    if (res.ok) { toast.success('그룹에 가입했습니다'); load() }
    else toast.error((await res.json()).error)
  }

  async function handleLeave() {
    const res = await fetch(`/api/groups/${id}/join`, { method: 'DELETE' })
    if (res.ok) { toast.success('그룹을 탈퇴했습니다'); load() }
    else toast.error((await res.json()).error)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const data = await res.json()
      await fetch(`/api/groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: data.url }) })
      load()
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleSaveDesc() {
    await fetch(`/api/groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc }) })
    setEditing(false); load()
  }

  async function handleDelete() {
    if (!confirm('그룹을 삭제하시겠습니까? 모든 게시글과 채팅이 삭제됩니다.')) return
    const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('그룹이 삭제되었습니다'); router.push('/groups') }
    else toast.error('삭제 실패')
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="h-64 bg-surface border border-border rounded-2xl animate-pulse" /></div>
  if (!group) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-text-secondary">그룹을 찾을 수 없습니다</div>

  const isOwner = session?.user?.id === group.ownerId
  const isAdmin = session?.user?.role === 'ADMIN'
  const isMod = group.myMembership?.role === 'ADMIN' || isOwner || isAdmin
  const isMember = !!group.myMembership

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Banner / Header */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            {group.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.avatar} alt={group.name} className="w-20 h-20 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-3xl">
                {group.name[0].toUpperCase()}
              </div>
            )}
            {isMod && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent-dim shadow">
                <Camera size={13} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{group.name}</h1>
              <div className="flex gap-1.5 shrink-0">
                {isMember ? (
                  !isOwner && (
                    <button onClick={handleLeave}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-red-400 hover:border-red-300 transition-colors">
                      <UserMinus size={13} /> 탈퇴
                    </button>
                  )
                ) : session?.user ? (
                  <button onClick={handleJoin}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-dim transition-colors">
                    <UserPlus size={13} /> 가입
                  </button>
                ) : null}
                {(isOwner || isAdmin) && (
                  <button onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-red-400 hover:border-red-300 transition-colors">
                    삭제
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              <div className="mt-2 space-y-2">
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
                <div className="flex gap-2">
                  <button onClick={handleSaveDesc} className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-dim">저장</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary">취소</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-2">
                <p className="text-sm text-text-secondary flex-1">{group.description || '설명 없음'}</p>
                {isMod && <button onClick={() => setEditing(true)} className="shrink-0"><Settings size={14} className="text-muted hover:text-text-secondary" /></button>}
              </div>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-muted">
              <span>{group.members.length}명</span>
              <span>{group._count.posts}개 글</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: `/groups/${id}/board`, icon: FileText, label: '게시판', count: group._count.posts },
          { href: `/groups/${id}/chat`, icon: MessageSquare, label: '채팅', count: group._count.messages },
          { href: `/groups/${id}/ranking`, icon: Trophy, label: '랭킹', count: group.members.length },
        ].map(({ href, icon: Icon, label, count }) => (
          <Link key={href} href={href}
            className="flex flex-col items-center gap-1.5 p-4 bg-surface border border-border rounded-xl hover:border-border-2 hover:bg-surface-2 transition-all">
            <Icon size={20} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">{label}</span>
            <span className="text-xs text-muted">{count}</span>
          </Link>
        ))}
      </div>

      {/* Members */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">멤버 ({group.members.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {group.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors">
              <Avatar name={m.user.name} image={m.user.image} size={32} />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-text-primary truncate">{m.user.name ?? '?'}</span>
                  {m.role === 'ADMIN' && <span className="text-xs px-1 bg-accent/10 text-accent rounded">운영</span>}
                  {m.user.id === group.ownerId && <span className="text-xs px-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded">장</span>}
                </div>
                <TierBadge points={m.user.points} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

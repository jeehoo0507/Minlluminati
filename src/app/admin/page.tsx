'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { UserPlus, Trash2, Shield, ShieldOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdminUser {
  id: string; email: string; name?: string | null; image?: string | null; role: string; points: number; createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'users' | 'invite'>('users')

  useEffect(() => {
    if (status === 'loading') return
    if (session?.user?.role !== 'ADMIN') { router.replace('/feed'); return }
    loadUsers()
  }, [session, status, router])

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
  }

  async function invite() {
    if (!inviteEmail.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok) { toast.success('초대 이메일 등록 완료'); setInviteEmail('') }
      else toast.error(data.error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleAdmin(user: AdminUser) {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, role: newRole } : u))
      toast.success(`${user.name}의 역할이 ${newRole}로 변경되었습니다`)
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`${user.name}을 삭제하시겠습니까? 모든 게시글도 삭제됩니다.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) { setUsers((p) => p.filter((u) => u.id !== user.id)); toast.success('삭제 완료') }
    else toast.error('삭제 실패')
  }

  if (status === 'loading' || session?.user?.role !== 'ADMIN') return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Shield className="text-accent" size={22} />
          관리자 패널
        </h1>
        <p className="text-sm text-text-secondary mt-1">사용자 관리 및 이메일 초대</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit">
        {(['users', 'invite'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-background' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {t === 'users' ? `유저 목록 (${users.length})` : '이메일 초대'}
          </button>
        ))}
      </div>

      {tab === 'invite' && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <UserPlus size={15} />
            새 멤버 초대
          </h2>
          <p className="text-xs text-text-secondary">
            이메일을 등록하면 해당 이메일로 <strong>/register</strong>에서 가입할 수 있습니다
          </p>
          <div className="flex gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
              placeholder="초대할 이메일"
              type="email"
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={invite}
              disabled={loading || !inviteEmail.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? '...' : '초대'}
            </button>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">유저</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">포인트</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">가입일</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={user.name} image={user.image} size={28} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-text-primary">{user.name ?? '?'}</span>
                          {user.role === 'ADMIN' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">관리자</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <TierBadge points={user.points} showPoints />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{timeAgo(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {user.id !== session?.user?.id && (
                        <>
                          <button
                            onClick={() => toggleAdmin(user)}
                            title={user.role === 'ADMIN' ? '관리자 해제' : '관리자 설정'}
                            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            {user.role === 'ADMIN' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          </button>
                          <button
                            onClick={() => deleteUser(user)}
                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

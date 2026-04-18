'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { AdminConfirmModal } from '@/components/ui/AdminConfirmModal'
import { timeAgo } from '@/lib/utils'
import { UserPlus, Trash2, Shield, ShieldOff, CheckCircle, XCircle, Swords, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdminUser {
  id: string; email: string; name?: string | null; image?: string | null; role: string; points: number; createdAt: string
}
interface PendingContest {
  id: string; title: string; createdAt: string
  organizer: { user: { id: string; name?: string | null } }
}
interface OrganizerRecord {
  id: string; userId: string
  user: { id: string; name?: string | null; email: string; image?: string | null }
}
interface AnyPost {
  id: string; title: string; subject: string; createdAt: string
  author: { id: string; name?: string | null }
}
interface AnyContest {
  id: string; title: string; status: string; createdAt: string
}

type ConfirmAction = { title: string; description?: string; onConfirm: (pw: string) => Promise<void> } | null

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [posts, setPosts] = useState<AnyPost[]>([])
  const [contests, setContests] = useState<AnyContest[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'users' | 'invite' | 'contests' | 'organizers' | 'posts' | 'allcontests'>('users')
  const [pendingContests, setPendingContests] = useState<PendingContest[]>([])
  const [organizers, setOrganizers] = useState<OrganizerRecord[]>([])
  const [orgEmail, setOrgEmail] = useState('')
  const [orgLoading, setOrgLoading] = useState(false)
  const [editPoints, setEditPoints] = useState<{ userId: string; current: number } | null>(null)
  const [newPoints, setNewPoints] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (session?.user?.role !== 'ADMIN') { router.replace('/feed'); return }
    loadAll()
  }, [session, status, router])

  async function loadAll() {
    loadUsers(); loadPendingContests(); loadOrganizers()
  }

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
  }
  async function loadPendingContests() {
    const res = await fetch('/api/admin/contests')
    if (res.ok) setPendingContests(await res.json())
  }
  async function loadOrganizers() {
    const res = await fetch('/api/admin/organizers')
    if (res.ok) setOrganizers(await res.json())
  }
  async function loadPosts() {
    const res = await fetch('/api/posts?limit=100')
    if (res.ok) { const d = await res.json(); setPosts(d.posts ?? []) }
  }
  async function loadContests() {
    const res = await fetch('/api/contests')
    if (res.ok) { const d = await res.json(); setContests(d ?? []) }
  }

  async function invite() {
    if (!inviteEmail.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok) { toast.success('초대 이메일 등록 완료'); setInviteEmail('') }
      else toast.error(data.error)
    } finally { setLoading(false) }
  }

  async function toggleAdmin(user: AdminUser) {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, role: newRole } : u))
      toast.success(`${user.name}의 역할이 ${newRole}로 변경되었습니다`)
    }
  }

  function confirmDeleteUser(user: AdminUser) {
    setConfirmAction({
      title: `${user.name} 계정 삭제`,
      description: '이 작업은 되돌릴 수 없습니다. 모든 게시글도 삭제됩니다.',
      onConfirm: async (pw) => {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPassword: pw }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setUsers((p) => p.filter((u) => u.id !== user.id))
        toast.success('삭제 완료')
        setConfirmAction(null)
      },
    })
  }

  function openEditPoints(user: AdminUser) {
    setEditPoints({ userId: user.id, current: user.points })
    setNewPoints(String(user.points))
  }

  function confirmSavePoints(userId: string) {
    const pts = Number(newPoints)
    if (isNaN(pts) || pts < 0) { toast.error('유효하지 않은 점수'); return }
    setConfirmAction({
      title: '포인트 수정',
      description: `포인트를 ${pts}pt 로 변경합니다.`,
      onConfirm: async (pw) => {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: pts, adminPassword: pw }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setUsers((p) => p.map((u) => u.id === userId ? { ...u, points: data.points } : u))
        setEditPoints(null)
        toast.success('포인트 수정 완료')
        setConfirmAction(null)
      },
    })
  }

  function confirmDeletePost(post: AnyPost) {
    setConfirmAction({
      title: `게시글 삭제: "${post.title}"`,
      description: '이 게시글과 관련 포인트가 모두 삭제됩니다.',
      onConfirm: async (pw) => {
        const res = await fetch(`/api/admin/posts/${post.id}`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPassword: pw }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setPosts((p) => p.filter((x) => x.id !== post.id))
        toast.success('게시글 삭제 완료')
        setConfirmAction(null)
      },
    })
  }

  function confirmDeleteContest(contest: AnyContest) {
    setConfirmAction({
      title: `대회 삭제: "${contest.title}"`,
      description: '대회와 모든 참가/제출 기록이 삭제됩니다.',
      onConfirm: async (pw) => {
        const res = await fetch(`/api/admin/contests/${contest.id}`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPassword: pw }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setContests((p) => p.filter((c) => c.id !== contest.id))
        toast.success('대회 삭제 완료')
        setConfirmAction(null)
      },
    })
  }

  async function reviewContest(contestId: string, action: 'APPROVED' | 'REJECTED') {
    const res = await fetch('/api/admin/contests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestId, action }),
    })
    if (res.ok) {
      toast.success(action === 'APPROVED' ? '승인되었습니다' : '거절되었습니다')
      setPendingContests((p) => p.filter((c) => c.id !== contestId))
    } else toast.error('처리 실패')
  }

  async function addOrganizer() {
    if (!orgEmail.trim()) return
    setOrgLoading(true)
    try {
      const res = await fetch('/api/admin/organizers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: orgEmail.trim() }),
      })
      if (res.ok) { toast.success('권한 부여 완료'); setOrgEmail(''); loadOrganizers() }
      else toast.error((await res.json()).error ?? '오류 발생')
    } finally { setOrgLoading(false) }
  }

  async function removeOrganizer(userId: string) {
    const res = await fetch('/api/admin/organizers', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) { toast.success('권한 해제 완료'); loadOrganizers() }
    else toast.error('처리 실패')
  }

  if (status === 'loading' || session?.user?.role !== 'ADMIN') return null

  const TABS = [
    { key: 'users', label: `유저 목록 (${users.length})` },
    { key: 'invite', label: '이메일 초대' },
    { key: 'contests', label: `대회 검토${pendingContests.length > 0 ? ` (${pendingContests.length})` : ''}` },
    { key: 'organizers', label: '대회 권한' },
    { key: 'posts', label: '게시글 관리' },
    { key: 'allcontests', label: '대회 관리' },
  ] as const

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {confirmAction && (
        <AdminConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Shield className="text-accent" size={22} /> 관리자 패널
        </h1>
        <p className="text-sm text-text-secondary mt-1">민감한 작업은 관리자 비밀번호 확인이 필요합니다</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-surface rounded-xl border border-border w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              if (key === 'posts' && posts.length === 0) loadPosts()
              if (key === 'allcontests' && contests.length === 0) loadContests()
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-accent text-background' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Invite */}
      {tab === 'invite' && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><UserPlus size={15} />새 멤버 초대</h2>
          <div className="flex gap-2">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()}
              placeholder="초대할 이메일" type="email"
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            <button onClick={invite} disabled={loading || !inviteEmail.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
              {loading ? '...' : '초대'}
            </button>
          </div>
        </div>
      )}

      {/* Contest review */}
      {tab === 'contests' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {pendingContests.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">검토 대기 중인 대회가 없습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">대회명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">주최자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">신청일</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
              </tr></thead>
              <tbody>
                {pendingContests.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{c.title}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.organizer?.user?.name ?? '?'}</td>
                    <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{timeAgo(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => reviewContest(c.id, 'APPROVED')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <CheckCircle size={13} /> 승인
                        </button>
                        <button onClick={() => reviewContest(c.id, 'REJECTED')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
                          <XCircle size={13} /> 거절
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Organizers */}
      {tab === 'organizers' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Swords size={15} />대회 주최자 권한 부여</h2>
            <div className="flex gap-2">
              <input value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOrganizer()}
                placeholder="이메일" type="email"
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <button onClick={addOrganizer} disabled={orgLoading || !orgEmail.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                {orgLoading ? '...' : '부여'}
              </button>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {organizers.length === 0 ? (
              <div className="text-center py-10 text-text-secondary text-sm">권한 보유자 없음</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">유저</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">이메일</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
                </tr></thead>
                <tbody>
                  {organizers.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={o.user.name} image={o.user.image} size={28} /><span className="font-medium text-text-primary">{o.user.name ?? '?'}</span></div></td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{o.user.email}</td>
                      <td className="px-4 py-3"><div className="flex justify-end"><button onClick={() => removeOrganizer(o.userId)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={14} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Posts management */}
      {tab === 'posts' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {posts.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">게시글 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">제목</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">작성자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">작성일</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">삭제</th>
              </tr></thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary truncate max-w-[200px]">{p.title}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{p.author?.name ?? '?'}</td>
                    <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{timeAgo(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => confirmDeletePost(p)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* All contests management */}
      {tab === 'allcontests' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          {contests.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">대회 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">대회명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">상태</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">생성일</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">삭제</th>
              </tr></thead>
              <tbody>
                {contests.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{c.title}</td>
                    <td className="px-4 py-3 text-xs text-muted">{c.status}</td>
                    <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{timeAgo(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => confirmDeleteContest(c)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2">
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">유저</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">이메일</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">포인트</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">가입일</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
            </tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={user.name} image={user.image} size={28} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-text-primary">{user.name ?? '?'}</span>
                          {user.role === 'ADMIN' && <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">관리자</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    {editPoints?.userId === user.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number" value={newPoints} onChange={(e) => setNewPoints(e.target.value)}
                          className="w-20 bg-background border border-border rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent"
                          onKeyDown={(e) => e.key === 'Enter' && confirmSavePoints(user.id)}
                        />
                        <button onClick={() => confirmSavePoints(user.id)} className="text-xs text-accent hover:underline">저장</button>
                        <button onClick={() => setEditPoints(null)} className="text-xs text-muted hover:underline">취소</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <TierBadge points={user.points} showPoints />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{timeAgo(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    {user.id !== session?.user?.id && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditPoints(user)} title="포인트 수정"
                          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => toggleAdmin(user)} title={user.role === 'ADMIN' ? '관리자 해제' : '관리자 설정'}
                          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          {user.role === 'ADMIN' ? <ShieldOff size={14} /> : <Shield size={14} />}
                        </button>
                        <button onClick={() => confirmDeleteUser(user)}
                          className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
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

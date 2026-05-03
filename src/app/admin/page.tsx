'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { AdminConfirmModal } from '@/components/ui/AdminConfirmModal'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'
import { UserPlus, Trash2, Shield, ShieldOff, CheckCircle, XCircle, Swords, Pencil, RotateCcw, Sliders, Bell, ShoppingBag, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { TIERS } from '@/lib/scoring'

interface AdminUser {
  id: string; email: string; name?: string | null; image?: string | null; role: string; points: number; createdAt: string
}
interface PendingContest {
  id: string; title: string; createdAt: string
  prize1?: number | null; prize2?: number | null; prize3?: number | null
  organizer: { id: string; name?: string | null }
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
interface PermReq {
  id: string; email: string; name?: string | null; message?: string | null; createdAt: string
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
  const [tab, setTab] = useState<string>('users')
  const [pendingContests, setPendingContests] = useState<PendingContest[]>([])
  const [organizers, setOrganizers] = useState<OrganizerRecord[]>([])
  const [orgEmail, setOrgEmail] = useState('')
  const [orgLoading, setOrgLoading] = useState(false)
  const [editPoints, setEditPoints] = useState<{ userId: string; current: number } | null>(null)
  const [newPoints, setNewPoints] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [permRequests, setPermRequests] = useState<PermReq[]>([])
  const [tierConfig, setTierConfig] = useState<{ name: string; min: number; max: number; color: string; bg: string }[]>(TIERS.map(t => ({ ...t, max: t.max === Infinity ? Infinity : Number(t.max) })))
  const [problemTierConfig, setProblemTierConfig] = useState<{ name: string; min: number; max: number; color: string; bg: string }[]>([])
  const [likePoints, setLikePoints] = useState(5)
  const [dailyPenalty, setDailyPenalty] = useState(10)
  const [tierSaving, setTierSaving] = useState(false)
  const [dailyStatus, setDailyStatus] = useState<{
    date: string; lastRunDate: string | null; alreadyRan: boolean;
    posted: { id: string; name?: string | null; image?: string | null; points: number }[];
    notPosted: { id: string; name?: string | null; image?: string | null; points: number }[];
  } | null>(null)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [penaltyRunning, setPenaltyRunning] = useState(false)
  const [penalizingUser, setPenalizingUser] = useState<string | null>(null)
  const [contestPrizes, setContestPrizes] = useState<Record<string, { p1: number; p2: number; p3: number }>>({})
  const [editingContestPrize, setEditingContestPrize] = useState<string | null>(null)
  const [allowedEmails, setAllowedEmails] = useState<{ id: string; email: string; usedAt: string | null; createdAt: string }[]>([])
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeContent, setNoticeContent] = useState('')
  const [noticeSending, setNoticeSending] = useState(false)
  const [allGroups, setAllGroups] = useState<{ id: string; name: string; isPublic: boolean; createdAt: string; owner: { id: string; name?: string | null; email: string }; _count: { members: number; posts: number } }[]>([])

  // Shop state
  const [shopBanners, setShopBanners] = useState<{ id: string; name: string; description: string; imageUrl: string; price: number; isActive: boolean }[]>([])
  const [shieldPrice, setShieldPrice] = useState(30)
  const [newBanner, setNewBanner] = useState({ name: '', description: '', imageUrl: '', price: 0 })
  const [bannerSaving, setBannerSaving] = useState(false)
  const [shopAdjUser, setShopAdjUser] = useState('')
  const [shopAdjDelta, setShopAdjDelta] = useState('')
  const [shopAdjLoading, setShopAdjLoading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const bannerFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (session?.user?.role !== 'ADMIN') { router.replace('/feed'); return }
    loadAll()
  }, [session, status, router])

  async function loadAll() {
    loadUsers(); loadPendingContests(); loadOrganizers(); loadAllowedEmails()
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
  async function loadPermRequests() {
    const res = await fetch('/api/admin/permission-requests')
    if (res.ok) setPermRequests(await res.json())
  }
  async function loadAllowedEmails() {
    const res = await fetch('/api/admin/allowed-emails')
    if (res.ok) setAllowedEmails(await res.json())
  }

  async function loadAllGroups() {
    const res = await fetch('/api/admin/groups')
    if (res.ok) setAllGroups(await res.json())
  }

  async function loadShopAdmin() {
    const res = await fetch('/api/admin/shop')
    if (res.ok) { const d = await res.json(); setShopBanners(d.banners); setShieldPrice(d.shieldPrice) }
  }

  async function saveShieldPrice() {
    const res = await fetch('/api/admin/shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setShieldPrice', price: shieldPrice }),
    })
    if (res.ok) toast.success('보호막 가격 저장 완료')
    else toast.error('저장 실패')
  }

  async function handleBannerImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBannerUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const data = await res.json()
      setNewBanner((p) => ({ ...p, imageUrl: data.url }))
      toast.success('이미지 업로드 완료')
    } finally {
      setBannerUploading(false)
      if (bannerFileRef.current) bannerFileRef.current.value = ''
    }
  }

  async function createBanner() {
    if (!newBanner.name || !newBanner.imageUrl || !newBanner.price) { toast.error('이름, 이미지 URL, 가격 필수'); return }
    setBannerSaving(true)
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBanner),
      })
      if (res.ok) { toast.success('배너 생성 완료'); setNewBanner({ name: '', description: '', imageUrl: '', price: 0 }); loadShopAdmin() }
      else toast.error('생성 실패')
    } finally { setBannerSaving(false) }
  }

  async function deleteBanner(id: string) {
    const res = await fetch('/api/admin/shop', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast.success('삭제 완료'); loadShopAdmin() }
    else toast.error('삭제 실패')
  }

  async function toggleBannerActive(id: string, isActive: boolean) {
    const res = await fetch('/api/admin/shop', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
    if (res.ok) loadShopAdmin()
    else toast.error('수정 실패')
  }

  async function adjustShopPoints() {
    const delta = parseInt(shopAdjDelta)
    if (!shopAdjUser || isNaN(delta)) { toast.error('유저 ID와 수치 필요'); return }
    setShopAdjLoading(true)
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjustPoints', userId: shopAdjUser, delta }),
      })
      const d = await res.json()
      if (res.ok) { toast.success(`상점 포인트 조정 완료 → ${d.newShopPoints}p`); setShopAdjUser(''); setShopAdjDelta('') }
      else toast.error(d.error ?? '오류')
    } finally { setShopAdjLoading(false) }
  }

  function confirmDeleteGroup(group: { id: string; name: string }) {
    setConfirmAction({
      title: `그룹 삭제: "${group.name}"`,
      description: '그룹과 모든 게시글, 채팅, 멤버 데이터가 삭제됩니다.',
      onConfirm: async (pw) => {
        const res = await fetch('/api/admin/groups', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: group.id, adminPassword: pw }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setAllGroups((p) => p.filter((g) => g.id !== group.id))
        toast.success('그룹 삭제 완료')
        setConfirmAction(null)
      },
    })
  }

  async function deleteAllowedEmail(id: string) {
    const res = await fetch('/api/admin/allowed-emails', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setAllowedEmails((p) => p.filter((e) => e.id !== id))
    else toast.error('삭제 실패')
  }

  async function sendAdminNotice() {
    if (!noticeTitle.trim() || !noticeContent.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    setNoticeSending(true)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noticeTitle.trim(), content: noticeContent.trim() }),
      })
      const d = await res.json()
      if (res.ok) { toast.success(`공지를 ${d.count}명에게 발송했습니다`); setNoticeTitle(''); setNoticeContent('') }
      else toast.error(d.error ?? '오류')
    } finally { setNoticeSending(false) }
  }

  async function loadDailyStatus() {
    setDailyLoading(true)
    try {
      const res = await fetch('/api/admin/daily-penalty')
      if (res.ok) setDailyStatus(await res.json())
    } finally { setDailyLoading(false) }
  }

  async function runDailyPenalty(force = false) {
    setPenaltyRunning(true)
    try {
      const res = await fetch('/api/admin/daily-penalty', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const d = await res.json()
      if (res.ok) {
        if (d.skipped) toast.success('오늘 이미 실행됨 (건너뜀)')
        else toast.success(`차감 완료: ${d.penalizedCount}명 -${d.penalty}pt`)
        loadDailyStatus()
      } else toast.error(d.error ?? '오류')
    } finally { setPenaltyRunning(false) }
  }

  async function penalizeUser(userId: string) {
    setPenalizingUser(userId)
    try {
      const res = await fetch('/api/admin/daily-penalty', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success(`차감 완료 (-${d.penalty}pt)`)
        setDailyStatus((prev) => prev ? {
          ...prev,
          notPosted: prev.notPosted.map((u) => u.id === userId ? { ...u, points: d.newPoints } : u),
        } : prev)
      } else toast.error(d.error ?? '오류')
    } finally { setPenalizingUser(null) }
  }

  async function loadTierConfig() {
    const res = await fetch('/api/admin/config')
    if (res.ok) {
      const d = await res.json()
      setTierConfig(d.tiers ?? TIERS.map((t) => ({ name: t.name, min: t.min, max: t.max === Infinity ? Infinity : Number(t.max), color: t.color, bg: t.bg })))
      setProblemTierConfig(d.problemTiers ?? [])
      setLikePoints(d.points?.likeReceived ?? 5)
      setDailyPenalty(d.points?.dailyPenalty ?? 10)
    }
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

  function confirmDataReset(scope: 'points' | 'all') {
    const isAll = scope === 'all'
    setConfirmAction({
      title: isAll ? '전체 데이터 초기화' : '포인트 초기화',
      description: isAll
        ? '⚠️ 모든 포인트, 게시글, 댓글, 추천이 삭제됩니다. 되돌릴 수 없습니다.'
        : '모든 유저의 포인트를 0으로 리셋합니다.',
      onConfirm: async (pw) => {
        const res = await fetch('/api/admin/reset', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPassword: pw, scope }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        toast.success('초기화 완료')
        setConfirmAction(null)
        loadUsers()
      },
    })
  }

  async function reviewContest(contestId: string, action: 'APPROVED' | 'REJECTED') {
    const prizes = contestPrizes[contestId]
    const res = await fetch('/api/admin/contests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contestId, action,
        ...(prizes ? { prize1: prizes.p1, prize2: prizes.p2, prize3: prizes.p3 } : {}),
      }),
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

  async function handlePermRequest(id: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/admin/permission-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      toast.success(action === 'approve' ? '승인 완료 (이메일 초대 등록됨)' : '거절 완료')
      setPermRequests((p) => p.filter((r) => r.id !== id))
    }
  }

  async function saveTiers() {
    setTierSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiers: tierConfig,
          problemTiers: problemTierConfig,
          points: { likeReceived: likePoints, dailyPenalty },
        }),
      })
      if (res.ok) toast.success('설정 저장 완료')
      else toast.error('저장 실패')
    } finally { setTierSaving(false) }
  }

  if (status === 'loading' || session?.user?.role !== 'ADMIN') return null

  const isOwner = session.user.isOwner

  const TABS: { key: string; label: string }[] = [
    { key: 'users', label: `유저 목록 (${users.length})` },
    { key: 'invite', label: '이메일 초대' },
    { key: 'emaillist', label: `초대 목록 (${allowedEmails.length})` },
    { key: 'requests', label: `권한 요청${permRequests.length > 0 ? ` (${permRequests.length})` : ''}` },
    { key: 'contests', label: `대회 검토${pendingContests.length > 0 ? ` (${pendingContests.length})` : ''}` },
    { key: 'organizers', label: '대회 권한' },
    { key: 'posts', label: '게시글 관리' },
    { key: 'allcontests', label: '대회 관리' },
    { key: 'groups', label: `그룹 관리${allGroups.length > 0 ? ` (${allGroups.length})` : ''}` },
    { key: 'tiers', label: '티어 설정' },
    { key: 'daily', label: '일일 현황' },
    { key: 'notice', label: '공지 발송' },
    { key: 'shop', label: '상점 관리' },
    ...(isOwner ? [{ key: 'reset', label: '⚠️ 초기화' }] : []),
  ]

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
      <div className="flex flex-wrap gap-1 p-1 bg-surface rounded-xl border border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              if (key === 'posts' && posts.length === 0) loadPosts()
              if (key === 'allcontests' && contests.length === 0) loadContests()
              if (key === 'groups') loadAllGroups()
              if (key === 'requests') loadPermRequests()
              if (key === 'tiers') loadTierConfig()
              if (key === 'daily') loadDailyStatus()
              if (key === 'emaillist') loadAllowedEmails()
              if (key === 'shop') loadShopAdmin()
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-accent text-background' : 'text-text-secondary hover:text-text-primary'}`}
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

      {/* Email list */}
      {tab === 'emaillist' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><UserPlus size={14} /> 초대된 이메일 목록</h2>
            <span className="text-xs text-muted">{allowedEmails.length}개</span>
          </div>
          {allowedEmails.length === 0 ? (
            <div className="text-center py-10 text-text-secondary text-sm">초대된 이메일이 없습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">초대일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">사용</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
              </tr></thead>
              <tbody>
                {allowedEmails.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">{e.email}</td>
                    <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell">{timeAgo(e.createdAt)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {e.usedAt ? <span className="text-xs text-green-600">✓ 사용됨</span> : <span className="text-xs text-muted">미사용</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => deleteAllowedEmail(e.id)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
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

      {/* Notice */}
      {tab === 'notice' && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Bell size={14} /> 전체 공지 발송</h2>
          <p className="text-xs text-text-secondary">모든 사용자에게 알림으로 공지를 보냅니다.</p>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">제목</label>
            <input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="공지 제목"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">내용</label>
            <textarea value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)}
              rows={4} placeholder="공지 내용을 입력하세요"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
          </div>
          <button onClick={sendAdminNotice} disabled={noticeSending || !noticeTitle.trim() || !noticeContent.trim()}
            className="px-5 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
            {noticeSending ? '발송 중...' : '전체 발송'}
          </button>
        </div>
      )}

      {/* Permission requests */}
      {tab === 'requests' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Bell size={14} /> 권한 요청</h2>
          </div>
          {permRequests.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">대기 중인 권한 요청이 없습니다</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">이름</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden lg:table-cell">메시지</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">신청일</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
              </tr></thead>
              <tbody>
                {permRequests.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">{r.email}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{r.name ?? '-'}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs hidden lg:table-cell max-w-[200px] truncate">{r.message ?? '-'}</td>
                    <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell">{timeAgo(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handlePermRequest(r.id, 'approve')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <CheckCircle size={12} /> 승인
                        </button>
                        <button onClick={() => handlePermRequest(r.id, 'reject')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
                          <XCircle size={12} /> 거절
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

      {/* Tier config */}
      {tab === 'tiers' && (
        <div className="space-y-4">
          {/* Like points */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Sliders size={15} /> 추천 포인트 설정</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">추천 1회당 지급 포인트</label>
              <input type="number" min={0} value={likePoints} onChange={(e) => setLikePoints(Number(e.target.value))}
                className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <span className="text-sm text-muted">pt</span>
            </div>
          </div>

          {/* Daily penalty */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Sliders size={15} /> 일일 미작성 패널티</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">하루 미작성 시 차감 포인트</label>
              <input type="number" min={0} value={dailyPenalty} onChange={(e) => setDailyPenalty(Number(e.target.value))}
                className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <span className="text-sm text-muted">pt</span>
            </div>
          </div>

          {/* User tiers */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Sliders size={15} /> 유저 티어 커트라인</h2>
            <div className="space-y-3">
              {tierConfig.map((tier, i) => (
                <div key={tier.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20" style={{ color: tier.color }}>{tier.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>최소</span>
                    <input type="number" min={0} value={tier.min}
                      onChange={(e) => setTierConfig((p) => p.map((t, j) => j === i ? { ...t, min: Number(e.target.value) } : t))}
                      className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent" />
                    <span>pt ~</span>
                    {i < tierConfig.length - 1 ? (
                      <>
                        <span>최대</span>
                        <input type="number" min={0} value={tier.max === Infinity ? '' : tier.max}
                          onChange={(e) => setTierConfig((p) => p.map((t, j) => j === i ? { ...t, max: e.target.value === '' ? Infinity : Number(e.target.value) } : t))}
                          className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent" />
                        <span>pt</span>
                      </>
                    ) : <span>∞</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Problem tiers */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Sliders size={15} /> 문제 티어 커트라인 (승인 포인트 기준)</h2>
            <div className="space-y-3">
              {problemTierConfig.map((tier, i) => (
                <div key={tier.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20" style={{ color: tier.color }}>{tier.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>최소</span>
                    <input type="number" min={0} value={tier.min}
                      onChange={(e) => setProblemTierConfig((p) => p.map((t, j) => j === i ? { ...t, min: Number(e.target.value) } : t))}
                      className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent" />
                    <span>pt ~</span>
                    {i < problemTierConfig.length - 1 ? (
                      <>
                        <span>최대</span>
                        <input type="number" min={0} value={tier.max === Infinity ? '' : tier.max}
                          onChange={(e) => setProblemTierConfig((p) => p.map((t, j) => j === i ? { ...t, max: e.target.value === '' ? Infinity : Number(e.target.value) } : t))}
                          className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent" />
                        <span>pt</span>
                      </>
                    ) : <span>∞</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveTiers} disabled={tierSaving}
            className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
            {tierSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {/* Data reset */}
      {tab === 'reset' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><RotateCcw size={15} /> 포인트 초기화</h2>
            <p className="text-xs text-text-secondary">모든 유저의 포인트를 0으로 리셋합니다. 포인트 히스토리도 초기화됩니다.</p>
            <button onClick={() => confirmDataReset('points')}
              className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
              포인트 초기화
            </button>
          </div>
          <div className="bg-surface border border-red-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-red-500 flex items-center gap-2"><RotateCcw size={15} /> 전체 데이터 초기화</h2>
            <p className="text-xs text-text-secondary">⚠️ 모든 포인트, 게시글, 댓글, 추천, 제출 기록을 초기화합니다. 되돌릴 수 없습니다.</p>
            <button onClick={() => confirmDataReset('all')}
              className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
              전체 초기화 (위험)
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
            <div className="divide-y divide-border">
              {pendingContests.map((c) => {
                const prizes = contestPrizes[c.id] ?? { p1: c.prize1 ?? 0, p2: c.prize2 ?? 0, p3: c.prize3 ?? 0 }
                const isEditing = editingContestPrize === c.id
                return (
                  <div key={c.id} className="px-4 py-3 hover:bg-surface-2 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-text-primary">{c.title}</p>
                        <p className="text-xs text-muted mt-0.5">{c.organizer?.name ?? '?'} · {timeAgo(c.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingContestPrize(isEditing ? null : c.id)
                            if (!contestPrizes[c.id]) setContestPrizes((p) => ({ ...p, [c.id]: prizes }))
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-surface border border-border transition-colors"
                        >
                          <Pencil size={11} /> 포인트 설정
                        </button>
                        <button onClick={() => reviewContest(c.id, 'APPROVED')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <CheckCircle size={13} /> 승인
                        </button>
                        <button onClick={() => reviewContest(c.id, 'REJECTED')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
                          <XCircle size={13} /> 거절
                        </button>
                      </div>
                    </div>
                    {isEditing && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {([['🥇 1등', 'p1'], ['🥈 2등', 'p2'], ['🥉 3등', 'p3']] as const).map(([label, key]) => (
                          <div key={key} className="flex items-center gap-1 text-xs text-text-secondary">
                            <span>{label}</span>
                            <input
                              type="number" min={0} value={prizes[key]}
                              onChange={(e) => setContestPrizes((p) => ({ ...p, [c.id]: { ...prizes, [key]: Number(e.target.value) } }))}
                              className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                            />
                            <span className="text-muted">pt</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">액션</th>
              </tr></thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary truncate max-w-[200px]">{p.title}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{p.author?.name ?? '?'}</td>
                    <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{timeAgo(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`/post/${p.id}/edit`} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          <Pencil size={14} />
                        </Link>
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

      {/* Group management */}
      {tab === 'groups' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">전체 그룹 목록</span>
            <button onClick={loadAllGroups} className="text-xs text-muted hover:text-text-primary transition-colors">새로고침</button>
          </div>
          {allGroups.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">그룹 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">그룹명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">공개</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary">소유자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">멤버/글</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">생성일</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary">삭제</th>
              </tr></thead>
              <tbody>
                {allGroups.map((g) => (
                  <tr key={g.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-text-primary">{g.name}</span>
                        {!g.isPublic && (
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded">비공개</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{g.isPublic ? '공개' : '비공개'}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{g.owner.name ?? g.owner.email}</td>
                    <td className="px-4 py-3 text-xs text-muted hidden md:table-cell">{g._count.members}명 · {g._count.posts}글</td>
                    <td className="px-4 py-3 text-xs text-muted hidden md:table-cell">{timeAgo(g.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => confirmDeleteGroup(g)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
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

      {/* Daily status */}
      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">오늘의 작성 현황</h2>
                {dailyStatus && (
                  <p className="text-xs text-muted mt-1">
                    {dailyStatus.date}
                    {dailyStatus.lastRunDate && ` · 마지막 차감: ${dailyStatus.lastRunDate}`}
                    {dailyStatus.alreadyRan && <span className="ml-2 text-emerald-500">✓ 오늘 차감 완료</span>}
                  </p>
                )}
              </div>
              <button onClick={() => loadDailyStatus()} disabled={dailyLoading}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                {dailyLoading ? '로딩 중...' : '새로고침'}
              </button>
            </div>
          </div>

          {dailyStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-emerald-500/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-emerald-600">오늘 업로드 완료</h3>
                  <span className="text-xs font-bold text-emerald-600">{dailyStatus.posted.length}명</span>
                </div>
                {dailyStatus.posted.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary text-xs">아직 아무도 올리지 않았습니다</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {dailyStatus.posted.map((u) => (
                      <li key={u.id} className="px-4 py-2.5 flex items-center gap-2">
                        <Avatar name={u.name} image={u.image} size={24} />
                        <span className="text-sm text-text-primary flex-1">{u.name ?? '?'}</span>
                        <TierBadge points={u.points} showPoints />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-red-500/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-red-500">미작성 (패널티 대상)</h3>
                  <span className="text-xs font-bold text-red-500">{dailyStatus.notPosted.length}명</span>
                </div>
                {dailyStatus.notPosted.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary text-xs">모두 작성했습니다!</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {dailyStatus.notPosted.map((u) => (
                      <li key={u.id} className="px-4 py-2.5 flex items-center gap-2">
                        <Avatar name={u.name} image={u.image} size={24} />
                        <span className="text-sm text-text-primary flex-1">{u.name ?? '?'}</span>
                        <TierBadge points={u.points} showPoints />
                        <button
                          onClick={() => penalizeUser(u.id)}
                          disabled={penalizingUser === u.id || u.points === 0}
                          className="ml-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-500 text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-40"
                        >
                          {penalizingUser === u.id ? '...' : '차감'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!dailyStatus && !dailyLoading && (
            <div className="text-center py-12 text-text-secondary text-sm">새로고침을 눌러 현황을 확인하세요</div>
          )}
        </div>
      )}

      {/* Shop management */}
      {tab === 'shop' && (
        <div className="space-y-5">
          {/* Shield price */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><ShoppingBag size={15} /> 보호막 가격 설정</h2>
            <div className="flex items-center gap-3">
              <input type="number" min={1} value={shieldPrice} onChange={(e) => setShieldPrice(Number(e.target.value))}
                className="w-28 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <span className="text-sm text-muted">상점 포인트</span>
              <button onClick={saveShieldPrice}
                className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors">
                저장
              </button>
            </div>
          </div>

          {/* Give/take shop points */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">상점 포인트 조정</h2>
            <div className="flex flex-wrap gap-2">
              <input value={shopAdjUser} onChange={(e) => setShopAdjUser(e.target.value)}
                placeholder="유저 ID"
                className="flex-1 min-w-40 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <input type="number" value={shopAdjDelta} onChange={(e) => setShopAdjDelta(e.target.value)}
                placeholder="±포인트 (예: 50 또는 -20)"
                className="w-40 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <button onClick={adjustShopPoints} disabled={shopAdjLoading}
                className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                {shopAdjLoading ? '...' : '조정'}
              </button>
            </div>
            <p className="text-xs text-muted">유저 ID는 유저 목록에서 확인하거나 프로필 URL에서 복사하세요.</p>
          </div>

          {/* Banner CRUD */}
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Plus size={14} /> 배너 아이템 추가</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={newBanner.name} onChange={(e) => setNewBanner((p) => ({ ...p, name: e.target.value }))}
                placeholder="배너 이름"
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <input type="number" min={1} value={newBanner.price || ''} onChange={(e) => setNewBanner((p) => ({ ...p, price: Number(e.target.value) }))}
                placeholder="가격 (상점 포인트)"
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <div className="col-span-full">
                <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} />
                <button type="button" onClick={() => bannerFileRef.current?.click()} disabled={bannerUploading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50">
                  <Plus size={14} />
                  {bannerUploading ? '업로드 중...' : newBanner.imageUrl ? '이미지 변경' : '배너 이미지 업로드'}
                </button>
              </div>
              <input value={newBanner.description} onChange={(e) => setNewBanner((p) => ({ ...p, description: e.target.value }))}
                placeholder="설명 (선택)"
                className="col-span-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            {newBanner.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={newBanner.imageUrl} alt="preview" className="w-full h-20 object-cover rounded-lg border border-border" />
            )}
            <button onClick={createBanner} disabled={bannerSaving}
              className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
              {bannerSaving ? '생성 중...' : '배너 생성'}
            </button>
          </div>

          {/* Banner list */}
          {shopBanners.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-2">
                <h3 className="text-sm font-semibold text-text-secondary">배너 목록 ({shopBanners.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {shopBanners.map((b) => (
                  <div key={b.id} className="p-4 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.imageUrl} alt={b.name} className="w-24 h-14 object-cover rounded-lg border border-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary">{b.name}</p>
                      <p className="text-xs text-muted">{b.price}p{b.description ? ` · ${b.description}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleBannerActive(b.id, !b.isActive)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${b.isActive ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-border text-muted'}`}>
                        {b.isActive ? '활성' : '비활성'}
                      </button>
                      <button onClick={() => deleteBanner(b.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                          {user.role === 'OWNER' && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-600 border border-yellow-500/30 font-semibold">OWNER</span>}
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
                        {session.user.isOwner && (
                          <button onClick={() => toggleAdmin(user)} title={user.role === 'ADMIN' ? '관리자 해제' : '관리자 설정'}
                            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                            {user.role === 'ADMIN' ? <ShieldOff size={14} /> : <Shield size={14} />}
                          </button>
                        )}
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

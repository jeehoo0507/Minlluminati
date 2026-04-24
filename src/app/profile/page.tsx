'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { StreakChart } from '@/components/ui/StreakChart'
import { PointLineChart } from '@/components/ui/PointLineChart'
import { RadarChart } from '@/components/ui/RadarChart'
import { Camera, UserMinus, Lock } from 'lucide-react'
import { getTier } from '@/lib/scoring'
import toast from 'react-hot-toast'

interface RivalUser { id: string; name?: string | null; image?: string | null; points: number }
interface ProfileData {
  streakMap: Record<string, number>
  pointTimeline: { date: string; points: number }[]
  radarData: { label: string; value: number }[]
  solvedProblems: { id: string; problemNumber: number; title: string; subject: string | null }[]
  isMaster: boolean
  isFirstRuby: boolean
}

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [rivals, setRivals] = useState<RivalUser[]>([])
  const [streakYear, setStreakYear] = useState(new Date().getFullYear())
  const [streakData, setStreakData] = useState<{ streakMap: Record<string, number>; streak: number } | null>(null)
  const [pointYear, setPointYear] = useState(new Date().getFullYear())
  const [pointData, setPointData] = useState<{ date: string; points: number }[]>([])

  // Password change
  const [showPwChange, setShowPwChange] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  async function loadStreak(userId: string, year: number) {
    const res = await fetch(`/api/users/${userId}/streak?year=${year}`)
    if (res.ok) setStreakData(await res.json())
  }

  async function loadPoints(userId: string, year: number) {
    const res = await fetch(`/api/users/${userId}/points?year=${year}`)
    if (res.ok) { const d = await res.json(); setPointData(d.timeline) }
  }

  useEffect(() => {
    if (!session?.user) return
    setName(session.user.name ?? '')
    setImage(session.user.image ?? null)
    fetch(`/api/users/${session.user.id}`).then((r) => r.json()).then(setProfileData)
    fetch('/api/rivals').then((r) => r.json()).then(setRivals)
    loadStreak(session.user.id, streakYear)
    loadPoints(session.user.id, pointYear)
  }, [session])

  if (!session?.user) { router.replace('/login'); return null }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); setPreviewUrl(null); return }
      const data = await res.json()
      setImage(data.url)
      toast.success('이미지 업로드 완료')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('닉네임을 입력해주세요'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), image }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      await update({ name: name.trim(), image })
      setPreviewUrl(null)
      toast.success('프로필 저장')
    } finally { setSaving(false) }
  }

  async function handlePasswordChange() {
    if (!currentPw || !newPw || !confirmPw) { toast.error('모든 항목을 입력해주세요'); return }
    if (newPw !== confirmPw) { toast.error('새 비밀번호가 일치하지 않습니다'); return }
    if (newPw.length < 6) { toast.error('6자 이상 입력해주세요'); return }
    setPwLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (!res.ok) { toast.error((await res.json()).error); return }
      toast.success('비밀번호가 변경되었습니다')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setShowPwChange(false)
    } finally { setPwLoading(false) }
  }

  async function removeRival(rivalId: string) {
    await fetch('/api/rivals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rivalId }),
    })
    setRivals((p) => p.filter((r) => r.id !== rivalId))
    toast.success('라이벌 해제')
  }

  const tier = getTier(session.user.points ?? 0)
  const displayImage = previewUrl ?? image

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">
      <h1 className="text-2xl font-bold text-text-primary">내 프로필</h1>

      {/* Profile settings */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImage} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <Avatar name={name || session.user.name} image={null} size={80} />
            )}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent-dim transition-colors shadow">
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-text-primary text-lg">{name || '?'}</p>
              {profileData?.isFirstRuby && (
                <span className="text-xs font-medium italic" style={{ color: '#9ca3af' }}>first ruby</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <TierBadge points={session.user.points ?? 0} isMaster={profileData?.isMaster ?? false} />
              <span className="text-sm font-semibold" style={{ color: profileData?.isMaster ? '#f59e0b' : tier.color }}>
                {profileData?.isMaster ? '마스터' : tier.name}
              </span>
              <span className="text-sm text-muted">· {(session.user.points ?? 0).toLocaleString()}pt</span>
            </div>
            <p className="text-xs text-muted mt-0.5">{uploading ? '업로드 중...' : '카메라 버튼으로 사진 변경'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">이메일</label>
            <input value={session.user.email ?? ''} disabled
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-muted" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">닉네임</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="닉네임"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || uploading}
          className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>

        {/* Password change */}
        <div className="border-t border-border pt-4">
          <button onClick={() => setShowPwChange(!showPwChange)}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <Lock size={13} /> {showPwChange ? '비밀번호 변경 닫기' : '비밀번호 변경'}
          </button>
          {showPwChange && (
            <div className="mt-3 space-y-2">
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="현재 비밀번호"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="새 비밀번호 확인"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordChange()} />
              <button onClick={handlePasswordChange} disabled={pwLoading}
                className="w-full py-2 rounded-lg bg-surface-2 border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 hover:border-border-2 transition-colors disabled:opacity-50">
                {pwLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Streak */}
      {profileData && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-secondary">활동 분석</h2>
            <Link href={`/profile/${session.user.id}`} className="text-xs text-accent hover:underline">공개 프로필 →</Link>
          </div>
          <StreakChart
            streakMap={streakData?.streakMap ?? profileData.streakMap ?? {}}
            year={streakYear}
            streak={streakData?.streak ?? 0}
            onYearChange={(y) => { setStreakYear(y); if (session?.user) loadStreak(session.user.id, y) }}
          />
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-secondary mb-2 font-medium">포인트 변화</p>
            <PointLineChart
              data={pointData}
              year={pointYear}
              onYearChange={(y) => { setPointYear(y); if (session?.user) loadPoints(session.user.id, y) }}
            />
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-secondary mb-2 font-medium">
              푼 문제 <span className="text-muted font-normal">({profileData.solvedProblems.length})</span>
            </p>
            {profileData.solvedProblems.length === 0 ? (
              <p className="text-xs text-muted py-2">아직 푼 문제가 없습니다</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profileData.solvedProblems.map((p) => (
                  <Link
                    key={p.id}
                    href={`/problems/${p.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                  >
                    <span className="font-mono font-semibold">#{p.problemNumber}</span>
                    <span className="text-emerald-400/80 truncate max-w-[120px]">{p.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-secondary mb-1 font-medium">기여 분야</p>
            <RadarChart data={profileData.radarData} />
          </div>
        </div>
      )}

      {/* Rivals */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">내 라이벌 ({rivals.length})</h2>
        {rivals.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">랭킹에서 상대방 프로필을 눌러 라이벌 등록하세요</p>
        ) : (
          <div className="space-y-2">
            {rivals.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors">
                <Link href={`/profile/${r.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar name={r.name} image={r.image} size={32} />
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-text-primary truncate block">{r.name ?? '?'}</span>
                    <TierBadge points={r.points} />
                  </div>
                  <span className="text-sm text-accent font-semibold ml-auto">{r.points}pt</span>
                </Link>
                <button onClick={() => removeRival(r.id)} className="p-1.5 text-muted hover:text-red-400 transition-colors shrink-0">
                  <UserMinus size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

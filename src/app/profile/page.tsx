'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { StreakChart } from '@/components/ui/StreakChart'
import { Camera, UserMinus } from 'lucide-react'
import { getTier } from '@/lib/scoring'
import toast from 'react-hot-toast'

interface RivalUser { id: string; name?: string | null; image?: string | null; points: number }

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [streakMap, setStreakMap] = useState<Record<string, number>>({})
  const [rivals, setRivals] = useState<RivalUser[]>([])

  useEffect(() => {
    if (!session?.user) return
    setName(session.user.name ?? '')
    setImage(session.user.image ?? null)
    // Load my profile data for streak
    fetch(`/api/users/${session.user.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.streakMap) setStreakMap(d.streakMap) })
    fetch('/api/rivals').then((r) => r.json()).then(setRivals)
  }, [session])

  if (!session?.user) {
    router.replace('/login')
    return null
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Show preview immediately
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
    setLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), image }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류 발생'); return }
      await update({ name: name.trim(), image })
      setPreviewUrl(null)
      toast.success('프로필이 저장되었습니다')
    } finally { setLoading(false) }
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

      {/* Settings card */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImage} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <Avatar name={name || session.user.name} image={null} size={80} />
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent-dim transition-colors shadow"
            >
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          <div>
            <p className="font-semibold text-text-primary text-lg">{name || '?'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <TierBadge points={session.user.points ?? 0} />
              <span className="text-sm font-semibold" style={{ color: tier.color }}>{tier.name}</span>
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="닉네임 입력"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || uploading}
          className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* Streak */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">내 활동 스트릭</h2>
        <StreakChart streakMap={streakMap} />
        <div className="mt-3">
          <Link href={`/profile/${session.user.id}`} className="text-xs text-accent hover:underline">
            공개 프로필 보기 →
          </Link>
        </div>
      </div>

      {/* Rivals */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">내 라이벌 ({rivals.length})</h2>
        {rivals.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            랭킹에서 상대방 프로필을 눌러 라이벌 등록하세요
          </p>
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
                <button
                  onClick={() => removeRival(r.id)}
                  className="p-1.5 text-muted hover:text-red-400 transition-colors shrink-0"
                >
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

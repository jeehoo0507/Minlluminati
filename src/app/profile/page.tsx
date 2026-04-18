'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    setName(session.user.name ?? '')
    setImage(session.user.image ?? null)
  }, [session])

  if (!session?.user) {
    router.replace('/login')
    return null
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const data = await res.json()
      setImage(data.url)
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
      toast.success('프로필이 저장되었습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">프로필 설정</h1>

      <div className="bg-surface border border-border rounded-2xl p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar name={name || session.user.name} image={image} size={80} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent-dim transition-colors shadow"
            >
              <Camera size={13} />
            </button>
          </div>
          <p className="text-xs text-muted">{uploading ? '업로드 중...' : '클릭해서 프로필 사진 변경'}</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Info */}
        <div className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">포인트 / 티어</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg">
              <span className="text-sm text-text-primary font-medium">{session.user.points ?? 0}pt</span>
              <TierBadge points={session.user.points ?? 0} />
            </div>
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
    </div>
  )
}

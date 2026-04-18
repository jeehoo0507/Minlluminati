'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

export default function NewGroupPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)

  if (!session?.user) { router.replace('/login'); return null }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('그룹명을 입력해주세요'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, isPublic }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류 발생'); return }
      const group = await res.json()
      toast.success('그룹이 만들어졌습니다')
      router.push(`/groups/${group.id}`)
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">그룹 만들기</h1>
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">그룹명</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="그룹 이름"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">설명 (선택)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="그룹 소개"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-text-primary">공개 그룹</p>
            <p className="text-xs text-muted">비공개 시 그룹 목록에 표시되지 않습니다</p>
          </div>
          <button onClick={() => setIsPublic(!isPublic)}
            className={`w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-accent' : 'bg-border-2'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-2 transition-colors">취소</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
            {loading ? '만드는 중...' : '그룹 만들기'}
          </button>
        </div>
      </div>
    </div>
  )
}

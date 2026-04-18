'use client'
import { useState } from 'react'
import { Shield, X } from 'lucide-react'

interface Props {
  title: string
  description?: string
  onConfirm: (password: string) => Promise<void>
  onClose: () => void
}

export function AdminConfirmModal({ title, description, onConfirm, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!password) { setError('비밀번호를 입력해주세요'); return }
    setLoading(true)
    setError('')
    try {
      await onConfirm(password)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text-secondary transition-colors">
            <X size={16} />
          </button>
        </div>
        {description && <p className="text-xs text-text-secondary">{description}</p>}
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">관리자 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="비밀번호 입력"
            autoFocus
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !password}
            className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

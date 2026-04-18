'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { toast.error('비밀번호가 일치하지 않습니다'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }

      toast.success('가입 완료! 로그인합니다')
      await signIn('credentials', { email, password, callbackUrl: '/feed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-accent">Min(joon)</span>lluminati
          </h1>
          <p className="text-sm text-text-secondary mt-1">관리자가 초대한 이메일로 가입하세요</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="초대받은 이메일"
              required
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="닉네임"
              required
              maxLength={20}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              required
              minLength={6}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="비밀번호 확인"
              required
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-accent text-background font-semibold text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </form>

          <p className="text-center text-xs text-text-secondary mt-4">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-accent hover:underline">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

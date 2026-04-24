'use client'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

type Step = 'email' | 'password' | 'setup' | 'request'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/feed'

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')
  const [reqMessage, setReqMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailNext(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const { status } = await res.json()
      if (status === 'not_allowed') {
        setStep('request')
      } else if (status === 'needs_setup') {
        setStep('setup')
      } else {
        setStep('password')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await signIn('credentials', { email, password, redirect: false, callbackUrl })
      if (result?.error) toast.error('비밀번호가 올바르지 않습니다.')
      else { router.push(callbackUrl); router.refresh() }
    } finally {
      setLoading(false)
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { toast.error('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 6) { toast.error('비밀번호는 6자 이상이어야 합니다.'); return }
    if (!name.trim()) { toast.error('닉네임을 입력해주세요.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      const result = await signIn('credentials', { email, password, redirect: false, callbackUrl })
      if (result?.error) toast.error('로그인 실패. 다시 시도해주세요.')
      else { router.push(callbackUrl); router.refresh() }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">양현재<span className="text-accent">+</span></h1>
      </div>

      <div className="border border-border rounded-lg p-6 bg-surface shadow-sm">
        {step === 'email' && (
          <form onSubmit={handleEmailNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                autoFocus
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? '확인 중...' : '다음'}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-text-primary">비밀번호</label>
                <span className="text-xs text-text-secondary">{email}</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                autoFocus
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <button type="button" onClick={() => setStep('email')} className="w-full text-xs text-text-secondary hover:text-text-primary">
              이메일 변경
            </button>
          </form>
        )}

        {step === 'request' && (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              등록되지 않은 이메일입니다. 관리자에게 접근 권한을 요청할 수 있습니다.
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">이름 (선택)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름이나 닉네임"
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent placeholder:text-muted" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">요청 메시지 (선택)</label>
              <textarea value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} rows={2}
                placeholder="가입 목적이나 소속 등을 적어주세요"
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none placeholder:text-muted" />
            </div>
            <button
              type="button" disabled={loading}
              onClick={async () => {
                setLoading(true)
                try {
                  const res = await fetch('/api/permission-request', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name: name.trim(), message: reqMessage.trim() }),
                  })
                  if (res.ok) { toast.success('권한 요청이 전송되었습니다'); setStep('email') }
                  else toast.error((await res.json()).error ?? '오류 발생')
                } finally { setLoading(false) }
              }}
              className="w-full py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? '전송 중...' : '권한 요청 보내기'}
            </button>
            <button type="button" onClick={() => setStep('email')} className="w-full text-xs text-text-secondary hover:text-text-primary">
              이메일 변경
            </button>
          </div>
        )}

        {step === 'setup' && (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="p-3 bg-accent-light border border-blue-200 rounded text-sm text-accent">
              초대된 이메일입니다. 닉네임과 비밀번호를 설정해주세요.
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">이메일</label>
              <input
                value={email}
                disabled
                className="w-full border border-border rounded px-3 py-2 text-sm bg-surface text-text-secondary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">닉네임</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="사용할 닉네임"
                required
                maxLength={20}
                autoFocus
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">비밀번호 확인</label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="비밀번호 재입력"
                required
                className="w-full bg-background text-text-primary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? '설정 중...' : '계정 설정 완료'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <Suspense fallback={<div className="w-full max-w-sm h-64 bg-surface border border-border rounded-lg animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}

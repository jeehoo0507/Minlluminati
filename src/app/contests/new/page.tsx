'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, UserPlus, X, ImagePlus, RefreshCw, RefreshCwOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface Problem {
  title: string
  content: string
  answer: string
  extraAnswers: string[]
  points: number
  imageUrls: string[]
  allowRetry: boolean
}
interface Contributor { query: string; role: 'CONTRIBUTOR' | 'REVIEWER' }

export default function NewContestPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [durationMin, setDurationMin] = useState(120)
  const [prize1, setPrize1] = useState('')
  const [prize2, setPrize2] = useState('')
  const [prize3, setPrize3] = useState('')
  const [problems, setProblems] = useState<Problem[]>([
    { title: '', content: '', answer: '', extraAnswers: [], points: 100, imageUrls: [], allowRetry: true },
  ])
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [contribQuery, setContribQuery] = useState('')
  const [contribRole, setContribRole] = useState<'CONTRIBUTOR' | 'REVIEWER'>('CONTRIBUTOR')
  const [loading, setLoading] = useState(false)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  if (!session?.user) { router.replace('/login'); return null }

  function updateProblem<K extends keyof Problem>(i: number, field: K, value: Problem[K]) {
    setProblems((p) => p.map((pr, idx) => idx === i ? { ...pr, [field]: value } : pr))
  }

  async function uploadImages(idx: number, files: File[]) {
    if (!files.length) return
    setUploadingIdx(idx)
    try {
      const urls: string[] = []
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) { const d = await res.json(); urls.push(d.url) }
        else toast.error(`업로드 실패: ${file.name}`)
      }
      setProblems((p) => p.map((pr, i) => i === idx ? { ...pr, imageUrls: [...pr.imageUrls, ...urls] } : pr))
    } finally { setUploadingIdx(null) }
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('대회명을 입력해주세요'); return }
    for (const p of problems) {
      if (!p.title.trim() || !p.content.trim() || !p.answer.trim()) {
        toast.error('모든 문제의 제목/내용/정답을 입력해주세요'); return
      }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, rules, durationMin,
          prize1: prize1 ? Number(prize1) : 0,
          prize2: prize2 ? Number(prize2) : 0,
          prize3: prize3 ? Number(prize3) : 0,
          problems, contributors,
        }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류 발생'); return }
      const contest = await res.json()
      toast.success(session?.user?.role === 'ADMIN' ? '대회가 등록되었습니다' : '관리자 검토 후 공개됩니다')
      router.push(`/contests/${contest.id}`)
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-text-primary">대회 만들기</h1>
      {session.user.role !== 'ADMIN' && (
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg text-sm text-accent">
          관리자 검토 후 대회가 공개됩니다
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">기본 정보</h2>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">대회명</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="대회 이름을 입력하세요"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">설명</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="대회 설명 (목적, 수준 등)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">규칙 (선택)</label>
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={2}
            placeholder="대회 규칙, 유의사항 등"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">제한 시간 (분)</label>
          <input type="number" min={10} max={480} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-40 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">우승 포인트 (선택)</label>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: '🥇 1등', value: prize1, set: setPrize1 },
              { label: '🥈 2등', value: prize2, set: setPrize2 },
              { label: '🥉 3등', value: prize3, set: setPrize3 },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-xs text-text-secondary whitespace-nowrap">{label}</span>
                <input
                  type="number" min={0} value={value}
                  onChange={(e) => set(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-20 bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                <span className="text-xs text-muted">pt</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contributors */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">출제자 / 검토자 추가 (선택)</label>
          <div className="flex gap-2 mb-2">
            <input
              value={contribQuery}
              onChange={(e) => setContribQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && contribQuery.trim()) {
                  if (contributors.find((c) => c.query === contribQuery.trim())) { toast.error('이미 추가된 사용자입니다'); return }
                  setContributors((prev) => [...prev, { query: contribQuery.trim(), role: contribRole }])
                  setContribQuery('')
                }
              }}
              placeholder="이메일 또는 닉네임"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <select
              value={contribRole}
              onChange={(e) => setContribRole(e.target.value as 'CONTRIBUTOR' | 'REVIEWER')}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="CONTRIBUTOR">출제자</option>
              <option value="REVIEWER">검토자</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (!contribQuery.trim()) return
                if (contributors.find((c) => c.query === contribQuery.trim())) { toast.error('이미 추가된 사용자입니다'); return }
                setContributors((prev) => [...prev, { query: contribQuery.trim(), role: contribRole }])
                setContribQuery('')
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors"
            >
              <UserPlus size={13} /> 추가
            </button>
          </div>
          {contributors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contributors.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-xs text-text-secondary">
                  <span className="text-accent font-medium">{c.role === 'CONTRIBUTOR' ? '출제' : '검토'}</span>
                  {c.query}
                  <button onClick={() => setContributors((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-400 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Problems */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">문제 ({problems.length}개)</h2>
          <button onClick={() => setProblems((p) => [...p, { title: '', content: '', answer: '', extraAnswers: [], points: 100, imageUrls: [], allowRetry: true }])}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
            <Plus size={12} /> 문제 추가
          </button>
        </div>

        {problems.map((p, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-accent">문제 {labels[i]}</span>
              <div className="flex items-center gap-2">
                {/* allowRetry toggle */}
                <button
                  type="button"
                  onClick={() => updateProblem(i, 'allowRetry', !p.allowRetry)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${p.allowRetry ? 'text-green-600 bg-green-50 border border-green-200' : 'text-red-500 bg-red-50 border border-red-200'}`}
                  title={p.allowRetry ? '재시도 허용됨 (클릭하면 불가로)' : '재시도 불가 (클릭하면 허용으로)'}
                >
                  {p.allowRetry ? <><RefreshCw size={10} /> 재시도 허용</> : <><RefreshCwOff size={10} /> 재시도 불가</>}
                </button>
                {problems.length > 1 && (
                  <button onClick={() => setProblems((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">문제 제목</label>
              <input value={p.title} onChange={(e) => updateProblem(i, 'title', e.target.value)}
                placeholder={`문제 ${labels[i]} 제목`}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">문제 내용 (Markdown 지원)</label>
              <textarea value={p.content} onChange={(e) => updateProblem(i, 'content', e.target.value)} rows={5}
                placeholder="문제 내용, 수식 등 ($x^2$ 형식)"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y font-mono" />
            </div>

            {/* Images */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">이미지</label>
              <div className="flex items-center gap-2 flex-wrap">
                {p.imageUrls.map((url, ui) => (
                  <div key={url} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={() => updateProblem(i, 'imageUrls', p.imageUrls.filter((_, k) => k !== ui))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    ><X size={9} /></button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRefs.current[i]?.click()}
                  disabled={uploadingIdx === i}
                  className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-0.5 text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                >
                  <ImagePlus size={14} />
                  <span className="text-xs">{uploadingIdx === i ? '...' : '추가'}</span>
                </button>
                <input
                  ref={(el) => { fileRefs.current[i] = el }}
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { uploadImages(i, Array.from(e.target.files ?? [])); if (e.target) e.target.value = '' }}
                />
              </div>
            </div>

            {/* Answer + extra answers */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">정답</label>
              <div className="space-y-2">
                <input value={p.answer} onChange={(e) => updateProblem(i, 'answer', e.target.value)}
                  placeholder="정답 1 (필수, 대소문자·공백 무시)"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                {p.extraAnswers.map((ea, ei) => (
                  <div key={ei} className="flex gap-2">
                    <input
                      value={ea}
                      onChange={(e) => {
                        const next = [...p.extraAnswers]; next[ei] = e.target.value
                        updateProblem(i, 'extraAnswers', next)
                      }}
                      placeholder={`정답 ${ei + 2}`}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button type="button" onClick={() => updateProblem(i, 'extraAnswers', p.extraAnswers.filter((_, k) => k !== ei))} className="text-muted hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateProblem(i, 'extraAnswers', [...p.extraAnswers, ''])}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors"
                >
                  <Plus size={11} /> 정답 추가
                </button>
              </div>
            </div>

            <div className="w-28">
              <label className="block text-xs font-medium text-text-secondary mb-1">점수</label>
              <input
                type="number" min={1} value={p.points}
                onChange={(e) => updateProblem(i, 'points', Number(e.target.value) || 1)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={() => router.back()} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">취소</button>
        <button onClick={handleSubmit} disabled={loading}
          className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
          {loading ? '등록 중...' : '대회 등록'}
        </button>
      </div>
    </div>
  )
}

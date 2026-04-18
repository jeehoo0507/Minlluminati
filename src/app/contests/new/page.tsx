'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Problem { title: string; content: string; answer: string; points: number }

export default function NewContestPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [durationMin, setDurationMin] = useState(120)
  const [problems, setProblems] = useState<Problem[]>([{ title: '', content: '', answer: '', points: 100 }])
  const [loading, setLoading] = useState(false)

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  if (!session?.user) { router.replace('/login'); return null }

  function updateProblem(i: number, field: keyof Problem, value: string | number) {
    setProblems((p) => p.map((pr, idx) => idx === i ? { ...pr, [field]: value } : pr))
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('대회명을 입력해주세요'); return }
    for (const p of problems) {
      if (!p.title.trim() || !p.content.trim() || !p.answer.trim()) {
        toast.error('모든 문제의 제목/내용/답을 입력해주세요'); return
      }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, rules, durationMin, problems }),
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
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">문제 ({problems.length}개)</h2>
          <button onClick={() => setProblems((p) => [...p, { title: '', content: '', answer: '', points: 100 }])}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
            <Plus size={12} /> 문제 추가
          </button>
        </div>

        {problems.map((p, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-accent">문제 {labels[i]}</span>
              {problems.length > 1 && (
                <button onClick={() => setProblems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
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
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary mb-1">정답</label>
                <input value={p.answer} onChange={(e) => updateProblem(i, 'answer', e.target.value)}
                  placeholder="정답 (대소문자 무시)"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-text-secondary mb-1">점수</label>
                <input type="number" min={1} value={p.points} onChange={(e) => updateProblem(i, 'points', Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
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

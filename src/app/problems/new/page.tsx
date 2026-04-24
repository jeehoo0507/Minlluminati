'use client'
import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SUBJECTS, PROBLEM_SUBJECTS, type SubjectKey } from '@/lib/utils'
import { ArrowLeft, ImagePlus, X, Info, Plus, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface SubAnswerDef {
  label: string
  answer: string
  extra: string[]
}

export default function NewProblemPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [answer, setAnswer] = useState('')
  const [subject, setSubject] = useState('')
  const [requestedPts, setRequestedPts] = useState(10)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Answer mode state
  const [isEssay, setIsEssay] = useState(false)
  const [multiPartMode, setMultiPartMode] = useState(false)
  const [subAnswers, setSubAnswers] = useState<SubAnswerDef[]>([
    { label: '(1)', answer: '', extra: [] },
  ])
  const [subExtraInputs, setSubExtraInputs] = useState<string[]>([''])

  if (!session?.user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary">로그인이 필요합니다</p>
        <Link href="/login" className="mt-4 inline-block text-accent text-sm hover:underline">로그인</Link>
      </div>
    )
  }

  function insertImageAtCursor(url: string) {
    const insert = `![이미지](${url})`
    const ta = textareaRef.current
    const start = ta?.selectionStart ?? null
    const end = ta?.selectionEnd ?? null
    const s = start ?? content.length
    const e = end ?? content.length
    setContent((c) => c.slice(0, s) + insert + c.slice(e))
    setImageUrls((prev) => [...prev, url])
    if (ta && start !== null) {
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length
        ta.focus()
      })
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          insertImageAtCursor(data.url)
        } else {
          toast.error('이미지 업로드 실패')
        }
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function addSubAnswer() {
    setSubAnswers((prev) => [...prev, { label: `(${prev.length + 1})`, answer: '', extra: [] }])
    setSubExtraInputs((prev) => [...prev, ''])
  }

  function removeSubAnswer(i: number) {
    setSubAnswers((prev) => prev.filter((_, k) => k !== i))
    setSubExtraInputs((prev) => prev.filter((_, k) => k !== i))
  }

  function updateSubAnswer(i: number, field: keyof SubAnswerDef, value: string | string[]) {
    setSubAnswers((prev) => prev.map((s, k) => k === i ? { ...s, [field]: value } : s))
  }

  function addSubExtra(i: number) {
    const val = subExtraInputs[i]?.trim()
    if (!val) return
    updateSubAnswer(i, 'extra', [...subAnswers[i].extra, val])
    setSubExtraInputs((prev) => prev.map((v, k) => k === i ? '' : v))
  }

  function removeSubExtra(i: number, j: number) {
    updateSubAnswer(i, 'extra', subAnswers[i].extra.filter((_, k) => k !== j))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요')
      return
    }
    if (!isEssay) {
      if (multiPartMode) {
        if (subAnswers.length === 0) { toast.error('답변 슬롯을 최소 하나 추가해주세요'); return }
        if (subAnswers.some((s) => !s.answer.trim())) { toast.error('모든 답변 슬롯에 정답을 입력해주세요'); return }
      } else {
        if (!answer.trim()) { toast.error('정답을 입력해주세요'); return }
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          answer: isEssay ? '[essay]' : multiPartMode ? '[multi-part]' : answer.trim(),
          subject: subject || null,
          requestedPts,
          imageUrls,
          subAnswers: multiPartMode && !isEssay ? subAnswers : [],
          isEssay,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success('문제가 등록되었습니다. 관리자 검토 후 승인됩니다.')
        router.push(`/problems/${data.id}`)
      } else {
        const err = await res.json()
        toast.error(err.error ?? '등록 실패')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = isEssay
    ? !!(title.trim() && content.trim())
    : multiPartMode
      ? !!(title.trim() && content.trim() && subAnswers.length > 0 && subAnswers.every((s) => s.answer.trim()))
      : !!(title.trim() && content.trim() && answer.trim())

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link href="/problems" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        문제 목록으로
      </Link>

      <div>
        <h1 className="text-xl font-bold text-text-primary">문제 출제</h1>
        <p className="text-sm text-text-secondary mt-1">문제를 등록하면 관리자 검토 후 승인됩니다</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">제목 *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문제 제목을 입력하세요"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            required
          />
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">과목</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">과목 선택 (선택사항)</option>
            {PROBLEM_SUBJECTS.map((key) => (
              <option key={key} value={key}>{SUBJECTS[key as SubjectKey].label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">문제 내용 *</label>
          <p className="text-xs text-muted">마크다운과 수식(KaTeX)을 지원합니다. 수식은 $...$ 또는 $$...$$ 사용</p>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문제 내용을 입력하세요. 마크다운과 $수식$ 사용 가능 — 이미지 버튼으로 커서 위치에 삽입"
            rows={8}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-y font-mono"
            required
          />
        </div>

        {/* Images */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">이미지 첨부</label>
          <div className="flex items-center gap-2 flex-wrap">
            {imageUrls.map((url, i) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`img-${i}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrls((prev) => prev.filter((u) => u !== url))
                    setContent((c) => c.replace(`![이미지](${url})`, ''))
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
            >
              <ImagePlus size={18} />
              <span className="text-xs">{uploading ? '업로드중' : '추가'}</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Answer mode selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium text-text-primary">정답 방식</label>
            <button
              type="button"
              onClick={() => { setIsEssay(false); setMultiPartMode(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!multiPartMode && !isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/40 hover:text-accent'}`}
            >
              단일 답변
            </button>
            <button
              type="button"
              onClick={() => { setIsEssay(false); setMultiPartMode(true) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${multiPartMode && !isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/40 hover:text-accent'}`}
            >
              다중 필수 답변
            </button>
            <button
              type="button"
              onClick={() => { setIsEssay(true); setMultiPartMode(false) }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/40 hover:text-accent'}`}
            >
              <FileText size={11} /> 서술형
            </button>
          </div>

          {isEssay ? (
            <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
              <p className="text-xs text-accent font-medium mb-1">📝 서술형 문제</p>
              <p className="text-xs text-muted">풀이자가 글과 이미지로 답안을 제출합니다. 출제자 또는 관리자가 검토 후 승인/반려합니다. 승인 시 정답 처리 및 포인트가 지급됩니다.</p>
            </div>
          ) : !multiPartMode ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">정답은 대소문자 구분 없이, 공백 제외하고 비교됩니다</p>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="정답을 입력하세요"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-accent/5 border border-accent/20 rounded-xl">
              <p className="text-xs text-muted">풀이자가 모든 슬롯을 정확히 입력해야 정답 처리됩니다. 대소문자·공백 무시</p>
              {subAnswers.map((sub, i) => (
                <div key={i} className="space-y-2 p-3 bg-background border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    <input
                      value={sub.label}
                      onChange={(e) => updateSubAnswer(i, 'label', e.target.value)}
                      placeholder="레이블 (예: (1))"
                      className="w-24 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      value={sub.answer}
                      onChange={(e) => updateSubAnswer(i, 'answer', e.target.value)}
                      placeholder="정답"
                      className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                    {subAnswers.length > 1 && (
                      <button type="button" onClick={() => removeSubAnswer(i)} className="text-muted hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {/* Extra answers for this slot */}
                  {sub.extra.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {sub.extra.map((ea, j) => (
                        <span key={j} className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-full text-xs text-text-secondary">
                          {ea}
                          <button type="button" onClick={() => removeSubExtra(i, j)} className="text-muted hover:text-red-400"><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pl-1">
                    <input
                      value={subExtraInputs[i] ?? ''}
                      onChange={(e) => setSubExtraInputs((prev) => prev.map((v, k) => k === i ? e.target.value : v))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubExtra(i) } }}
                      placeholder="추가 정답 입력 후 Enter"
                      className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button type="button" onClick={() => addSubExtra(i)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors">
                      <Plus size={10} /> 추가
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSubAnswer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
              >
                <Plus size={12} /> 답변 슬롯 추가
              </button>
            </div>
          )}
        </div>

        {/* Requested Points */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">요청 점수</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100}
              value={requestedPts}
              onChange={(e) => setRequestedPts(parseInt(e.target.value) || 0)}
              className="w-28 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <span className="text-sm text-text-secondary">pt</span>
          </div>
          <div className="flex items-start gap-1.5 p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <Info size={13} className="text-accent mt-0.5 shrink-0" />
            <p className="text-xs text-text-secondary">
              요청 점수는 참고용이며, 관리자가 최종 승인 점수를 결정합니다. 승인된 문제를 처음 맞춘 사용자에게 점수가 지급됩니다.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="px-6 py-2.5 rounded-xl bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '등록 중...' : '문제 등록'}
          </button>
          <Link href="/problems" className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors">
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}

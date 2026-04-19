'use client'
import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SUBJECTS, PROBLEM_SUBJECTS, type SubjectKey } from '@/lib/utils'
import { ArrowLeft, ImagePlus, X, Info } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NewProblemPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [answer, setAnswer] = useState('')
  const [subject, setSubject] = useState('')
  const [requestedPts, setRequestedPts] = useState(10)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!session?.user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary">로그인이 필요합니다</p>
        <Link href="/login" className="mt-4 inline-block text-accent text-sm hover:underline">로그인</Link>
      </div>
    )
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          uploaded.push(data.url)
        } else {
          toast.error('이미지 업로드 실패')
        }
      }
      setImageUrls((prev) => [...prev, ...uploaded])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim() || !answer.trim()) {
      toast.error('제목, 내용, 정답을 모두 입력해주세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          answer: answer.trim(),
          subject: subject || null,
          requestedPts,
          imageUrls,
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
              <option key={key} value={key}>{SUBJECTS[key].label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">문제 내용 *</label>
          <p className="text-xs text-muted">마크다운과 수식(KaTeX)을 지원합니다. 수식은 $...$ 또는 $$...$$ 사용</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문제 내용을 입력하세요. 마크다운과 $수식$ 사용 가능"
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
                  onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
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

        {/* Answer */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">정답 *</label>
          <p className="text-xs text-muted">정답은 대소문자 구분 없이, 공백 제외하고 비교됩니다</p>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="정답을 입력하세요"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            required
          />
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
            disabled={submitting || !title.trim() || !content.trim() || !answer.trim()}
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

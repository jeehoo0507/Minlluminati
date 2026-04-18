'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { SUBJECTS, UNITS, type SubjectKey } from '@/lib/utils'
import { Upload, Eye, PenLine, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = [
  { value: 'PROBLEM', label: '문제' },
  { value: 'SOLUTION', label: '풀이' },
  { value: 'QUESTION', label: '질문' },
  { value: 'FREE', label: '자유' },
]

export function PostEditor() {
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState<SubjectKey>('MATH1_MID')
  const [unit, setUnit] = useState('')
  const [type, setType] = useState('PROBLEM')
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [fileUrls, setFileUrls] = useState<{ url: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)

  const units = UNITS[subject] ?? []

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) { toast.error('업로드 실패'); continue }
        const data = await res.json()
        if (file.type.startsWith('image/')) {
          setImageUrls((prev) => [...prev, data.url])
          setContent((c) => c + `\n![${file.name}](${data.url})\n`)
        } else {
          setFileUrls((prev) => [...prev, data])
        }
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit() {
    if (!session?.user) { toast.error('로그인이 필요합니다'); return }
    if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력해주세요'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, subject, unit: unit || null, type, imageUrls, fileUrls: fileUrls.map((f) => f.url) }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? '오류가 발생했습니다')
        return
      }
      const post = await res.json()
      toast.success('게시글이 등록되었습니다! +10pt')
      router.push(`/post/${post.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Type + Subject */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">유형</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">과목</label>
          <select
            value={subject}
            onChange={(e) => { setSubject(e.target.value as SubjectKey); setUnit('') }}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {(Object.entries(SUBJECTS) as [SubjectKey, { label: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {units.length > 0 && (
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">단원 (선택)</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">전체</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-text-secondary">내용 (Markdown + LaTeX 지원)</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPreview(false)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${!preview ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text-secondary'}`}
            >
              <PenLine size={11} /> 작성
            </button>
            <button
              onClick={() => setPreview(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${preview ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text-secondary'}`}
            >
              <Eye size={11} /> 미리보기
            </button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-60 bg-surface border border-border rounded-lg p-4 prose-content">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
              {content || '*내용이 없습니다*'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`내용을 입력하세요\n\n수식: $x^2 + y^2 = z^2$ 또는 $$\\int_0^\\infty e^{-x} dx = 1$$`}
            rows={14}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-y font-mono"
          />
        )}
        <p className="mt-1 text-xs text-muted">
          인라인 수식: <code className="text-accent">$수식$</code> · 블록 수식: <code className="text-accent">$$수식$$</code>
        </p>
      </div>

      {/* File upload */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-text-secondary">파일 첨부</label>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors"
          >
            <Upload size={12} className={uploading ? 'animate-spin' : ''} />
            {uploading ? '업로드 중...' : '파일 추가'}
          </button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} accept="image/*,.pdf" />
        {fileUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fileUrls.map((f) => (
              <div key={f.url} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary">
                <ImageIcon size={12} />
                <span className="max-w-32 truncate">{f.name}</span>
                <button onClick={() => setFileUrls((p) => p.filter((x) => x.url !== f.url))} className="text-muted hover:text-red-400 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim() || !content.trim()}
          className="px-5 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '등록 중...' : '등록하기 (+10pt)'}
        </button>
      </div>
    </div>
  )
}

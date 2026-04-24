'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { SUBJECTS, UNITS, type SubjectKey } from '@/lib/utils'
import { Upload, Eye, PenLine, X, FileText, Image as ImageIcon, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const DRAFT_KEY = 'post_editor_draft'

const TYPE_OPTIONS = [
  { value: 'PROBLEM', label: '문제' },
  { value: 'SOLUTION', label: '풀이' },
  { value: 'QUESTION', label: '질문' },
  { value: 'FREE', label: '자유' },
]

export function PostEditor({ initialSubject, initialType }: { initialSubject?: SubjectKey; initialType?: string } = {}) {
  // initialSubject and initialType are optional; defaults handled via useState
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState<SubjectKey>(initialSubject ?? 'MATH1')
  const [unit, setUnit] = useState('')
  const [type, setType] = useState(initialType ?? 'PROBLEM')
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [images, setImages] = useState<{ url: string; name: string }[]>([])
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([])
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const units = UNITS[subject] ?? []

  // 자동저장: 마운트 시 임시저장 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.title || draft.content) {
          setTitle(draft.title ?? '')
          setContent(draft.content ?? '')
          if (draft.subject) setSubject(draft.subject)
          if (draft.type) setType(draft.type)
          setLastSaved(new Date(draft.savedAt))
        }
      }
    } catch {}
  }, [])

  // 자동저장: 내용 변경 시 2초 후 저장
  useEffect(() => {
    if (!title && !content) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, subject, type, savedAt: new Date().toISOString() }))
        setLastSaved(new Date())
      } catch {}
    }, 2000)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [title, content, subject, type])

  async function uploadFile(file: File): Promise<{ url: string; name: string } | null> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) { toast.error(`업로드 실패: ${file.name}`); return null }
    return res.json()
  }

  const insertImageAtCursor = useCallback((url: string, name: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setContent((c) => c + `\n![${name}](${url})\n`)
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const insert = `![${name}](${url})`
    setContent((c) => c.slice(0, start) + insert + c.slice(end))
    // restore cursor after insert
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + insert.length
      ta.focus()
    })
  }, [])

  async function processFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const data = await uploadFile(file)
        if (!data) continue
        if (file.type.startsWith('image/')) {
          setImages((prev) => [...prev, data])
          insertImageAtCursor(data.url, data.name)
        } else {
          setAttachments((prev) => [...prev, data])
        }
      }
    } finally {
      setUploading(false)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(Array.from(e.target.files ?? []))
    if (fileRef.current) fileRef.current.value = ''
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // files: 파일 탐색기에서 복사, items: 스크린샷/웹 이미지 복사 (Ctrl+V)
    const fromFiles = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    const fromItems = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
    const imageFiles = fromFiles.length > 0 ? fromFiles : fromItems
    if (!imageFiles.length) return
    e.preventDefault()
    processFiles(imageFiles)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    // dataTransfer.files가 비어있으면 items에서 시도
    const fromFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    )
    const fromItems = Array.from(e.dataTransfer.items)
      .filter((item) => item.kind === 'file' && (item.type.startsWith('image/') || item.type === 'application/pdf'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
    const files = fromFiles.length > 0 ? fromFiles : fromItems
    processFiles(files)
  }

  async function handleSubmit() {
    if (!session?.user) { toast.error('로그인이 필요합니다'); return }
    if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, content, subject, unit: unit || null, type,
          imageUrls: images.map((i) => i.url),
          fileUrls: attachments.map((f) => f.url),
        }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류가 발생했습니다'); return }
      const post = await res.json()
      localStorage.removeItem(DRAFT_KEY)
      toast.success('게시글이 등록되었습니다!')
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

      {/* Content editor */}
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
          <div
            className={`relative rounded-lg border transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-border'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder={`내용을 입력하세요\n\n수식: $x^2 + y^2 = z^2$ 또는 $$\\int_0^\\infty e^{-x} dx = 1$$\n\n이미지: 드래그 앤 드롭 또는 Ctrl+V 붙여넣기`}
              rows={14}
              className="w-full bg-transparent rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none resize-y font-mono"
            />
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
                <div className="flex items-center gap-2 text-accent text-sm font-medium">
                  <ImageIcon size={16} />
                  이미지를 여기에 놓으세요
                </div>
              </div>
            )}
            {uploading && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-border rounded-lg shadow text-xs text-text-secondary">
                <Upload size={12} className="animate-bounce" />
                업로드 중...
              </div>
            )}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-xs text-muted">
            수식: <code className="text-accent">$수식$</code> · <code className="text-accent">$$수식$$</code>
          </p>
          <p className="text-xs text-muted">이미지 드래그 앤 드롭 · Ctrl+V 붙여넣기 지원</p>
        </div>
      </div>

      {/* Uploaded images preview */}
      {images.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">업로드된 이미지</p>
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-20 h-20 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={() => {
                    setImages((p) => p.filter((i) => i.url !== img.url))
                    setContent((c) => c.replace(`\n![${img.name}](${img.url})\n`, '').replace(`![${img.name}](${img.url})`, ''))
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-border rounded-full flex items-center justify-center text-muted hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File attachments */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-text-secondary">파일 첨부</label>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors disabled:opacity-50"
          >
            <Upload size={12} />
            파일 선택
          </button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileInput} accept="image/*,.pdf" />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((f) => (
              <div key={f.url} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary">
                <FileText size={12} />
                <span className="max-w-32 truncate">{f.name}</span>
                <button onClick={() => setAttachments((p) => p.filter((x) => x.url !== f.url))} className="text-muted hover:text-red-400 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Save size={11} />
              {lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 자동저장
            </span>
          )}
          {lastSaved && (
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY)
                setTitle(''); setContent(''); setLastSaved(null)
                toast.success('임시저장 초기화')
              }}
              className="text-xs text-muted hover:text-red-400 transition-colors"
            >
              초기화
            </button>
          )}
        </div>
        <div className="flex gap-2">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim() || !content.trim()}
          className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '등록 중...' : '등록하기'}
        </button>
        </div>
      </div>
    </div>
  )
}

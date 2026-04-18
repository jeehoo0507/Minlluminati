'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { SUBJECTS, UNITS, type SubjectKey } from '@/lib/utils'
import { Upload, Eye, PenLine, Image as ImageIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = [
  { value: 'PROBLEM', label: '문제' },
  { value: 'SOLUTION', label: '풀이' },
  { value: 'QUESTION', label: '질문' },
  { value: 'FREE', label: '자유' },
]

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState<SubjectKey>('MATH1_MID')
  const [unit, setUnit] = useState('')
  const [type, setType] = useState('PROBLEM')
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [images, setImages] = useState<{ url: string; name: string }[]>([])

  useEffect(() => {
    fetch(`/api/posts/${id}`).then((r) => r.json()).then((post) => {
      if (!post || !post.id) { toast.error('글을 찾을 수 없습니다'); router.push('/feed'); return }
      if (post.authorId !== session?.user?.id && session?.user?.role !== 'ADMIN') {
        toast.error('수정 권한이 없습니다'); router.push(`/post/${id}`); return
      }
      setTitle(post.title)
      setContent(post.content)
      setSubject(post.subject as SubjectKey)
      setUnit(post.unit ?? '')
      setType(post.type)
    })
  }, [id, session, router])

  const insertImageAtCursor = useCallback((url: string, name: string) => {
    const ta = textareaRef.current
    const insert = `![${name}](${url})`
    if (!ta) { setContent((c) => c + `\n${insert}\n`); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    setContent((c) => c.slice(0, s) + insert + c.slice(e))
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + insert.length; ta.focus() })
  }, [])

  async function processFiles(files: File[]) {
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) { toast.error(`업로드 실패: ${file.name}`); continue }
        const data = await res.json()
        if (file.type.startsWith('image/')) { setImages((p) => [...p, data]); insertImageAtCursor(data.url, data.name) }
      }
    } finally { setUploading(false) }
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, subject, unit: unit || null, type }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류 발생'); return }
      toast.success('수정되었습니다')
      router.push(`/post/${id}`)
    } finally { setLoading(false) }
  }

  const units = UNITS[subject] ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text-primary mb-6">글 수정</h1>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">유형</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">과목</label>
            <select value={subject} onChange={(e) => { setSubject(e.target.value as SubjectKey); setUnit('') }}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
              {(Object.entries(SUBJECTS) as [SubjectKey, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {units.length > 0 && (
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">단원</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="">전체</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text-secondary">내용</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setPreview(false)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${!preview ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text-secondary'}`}>
                <PenLine size={11} /> 작성
              </button>
              <button onClick={() => setPreview(true)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${preview ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text-secondary'}`}>
                <Eye size={11} /> 미리보기
              </button>
            </div>
          </div>
          {preview ? (
            <div className="min-h-60 bg-surface border border-border rounded-lg p-4 prose-content">
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className={`relative rounded-lg border transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-border'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); processFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))) }}>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)}
                onPaste={(e) => { const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/')); if (imgs.length) { e.preventDefault(); processFiles(imgs) } }}
                rows={14}
                className="w-full bg-transparent rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-muted focus:outline-none resize-y font-mono" />
              {uploading && <div className="absolute bottom-2 right-2 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-text-secondary"><Upload size={12} className="inline animate-bounce mr-1" />업로드 중...</div>}
            </div>
          )}
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="w-20 h-20 object-cover rounded-lg border border-border" />
                <button onClick={() => { setImages((p) => p.filter((i) => i.url !== img.url)); setContent((c) => c.replace(`![${img.name}](${img.url})`, '')) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-background border border-border rounded-full flex items-center justify-center text-muted hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-2 transition-colors disabled:opacity-50">
            <ImageIcon size={12} /> 이미지 추가
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
            onChange={(e) => { processFiles(Array.from(e.target.files ?? [])); if (fileRef.current) fileRef.current.value = '' }} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={() => router.push(`/post/${id}`)}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={loading || !title.trim() || !content.trim()}
            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

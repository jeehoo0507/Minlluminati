'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { SUBJECTS, PROBLEM_SUBJECTS, type SubjectKey } from '@/lib/utils'
import { Upload, Eye, PenLine, Image as ImageIcon, X, Plus, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

interface SubAnswerDef {
  label: string
  answer: string
  extra: string[]
}

export default function EditProblemPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [answer, setAnswer] = useState('')
  const [extraAnswers, setExtraAnswers] = useState<string[]>([])
  const [extraInput, setExtraInput] = useState('')
  const [subject, setSubject] = useState<SubjectKey>('MATH1')
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [images, setImages] = useState<{ url: string; name: string }[]>([])

  // Multi-part
  const [multiPartMode, setMultiPartMode] = useState(false)
  const [subAnswers, setSubAnswers] = useState<SubAnswerDef[]>([])
  const [subExtraInputs, setSubExtraInputs] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/problems/${id}`).then((r) => r.json()).then((p) => {
      if (!p || !p.id) { toast.error('문제를 찾을 수 없습니다'); router.push('/problems'); return }
      if (session?.user?.role !== 'ADMIN' && session?.user?.id !== p.author?.id) {
        toast.error('수정 권한이 없습니다'); router.push(`/problems/${id}`); return
      }
      setTitle(p.title)
      setContent(p.content)
      setAnswer(p.answer ?? '')
      setExtraAnswers(Array.isArray(p.extraAnswers) ? p.extraAnswers : (() => { try { return JSON.parse(p.extraAnswers ?? '[]') } catch { return [] } })())
      setSubject((p.subject as SubjectKey) ?? 'MATH1')

      // Load subAnswers
      const subs: SubAnswerDef[] = (() => {
        try {
          const parsed = JSON.parse(p.subAnswers ?? '[]')
          return Array.isArray(parsed) ? parsed.map((s: { label: string; answer: string; extra?: string[] }) => ({
            label: s.label ?? '',
            answer: s.answer ?? '',
            extra: Array.isArray(s.extra) ? s.extra : [],
          })) : []
        } catch { return [] }
      })()
      if (subs.length > 0) {
        setMultiPartMode(true)
        setSubAnswers(subs)
        setSubExtraInputs(subs.map(() => ''))
      } else {
        setSubAnswers([{ label: '(1)', answer: '', extra: [] }])
        setSubExtraInputs([''])
      }
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

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) { toast.error('제목과 내용을 입력해주세요'); return }

    if (multiPartMode) {
      if (subAnswers.length === 0 || subAnswers.some((s) => !s.answer.trim())) {
        toast.error('모든 답변 슬롯에 정답을 입력해주세요'); return
      }
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          answer: multiPartMode ? '[multi-part]' : answer,
          extraAnswers,
          subAnswers: multiPartMode ? subAnswers : [],
          subject,
        }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류 발생'); return }
      toast.success('수정되었습니다')
      router.push(`/problems/${id}`)
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text-primary mb-6">문제 수정 (관리자)</h1>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">과목</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value as SubjectKey)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent">
              {PROBLEM_SUBJECTS.map((k) => (
                <option key={k} value={k}>{SUBJECTS[k].label}</option>
              ))}
            </select>
          </div>
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

        {/* Answer mode toggle */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="block text-xs font-medium text-text-secondary">정답 방식</label>
            <button
              type="button"
              onClick={() => setMultiPartMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                multiPartMode
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'text-text-secondary border-border hover:border-accent/30 hover:text-accent'
              }`}
            >
              <Layers size={12} />
              {multiPartMode ? '다중 필수 답변' : '단일 답변'}
            </button>
          </div>

          {!multiPartMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">정답 (주 정답)</label>
                <input value={answer} onChange={(e) => setAnswer(e.target.value)}
                  placeholder="정답을 입력하세요"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">추가 정답 (복수 정답)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {extraAnswers.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-xs text-text-secondary">
                      {a}
                      <button onClick={() => setExtraAnswers((p) => p.filter((_, k) => k !== i))} className="text-muted hover:text-red-400"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={extraInput} onChange={(e) => setExtraInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && extraInput.trim()) { e.preventDefault(); setExtraAnswers((p) => [...p, extraInput.trim()]); setExtraInput('') } }}
                    placeholder="추가 정답 입력 후 Enter"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                  <button onClick={() => { if (extraInput.trim()) { setExtraAnswers((p) => [...p, extraInput.trim()]); setExtraInput('') } }}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors">
                    <Plus size={12} /> 추가
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">공백·대소문자 구분 없이 정답 처리됩니다</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-accent/5 border border-accent/20 rounded-xl">
              <p className="text-xs text-muted">풀이자가 모든 슬롯을 정확히 입력해야 정답 처리됩니다</p>
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

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={() => router.push(`/problems/${id}`)}
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

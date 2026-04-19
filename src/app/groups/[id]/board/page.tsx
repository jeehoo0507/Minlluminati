'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { ArrowLeft, PenLine, Trash2, ChevronDown, ImageIcon, FileText, Link2, X, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface LinkItem { label: string; url: string }
interface Post {
  id: string; title: string; content: string; createdAt: string
  imageUrls: string; fileUrls: string; links: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
}

function parseJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) } catch { return fallback }
}

export default function GroupBoardPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [writing, setWriting] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newImages, setNewImages] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<{ name: string; url: string }[]>([])
  const [newLinks, setNewLinks] = useState<LinkItem[]>([])
  const [linkInput, setLinkInput] = useState({ label: '', url: '' })
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [postsRes, groupRes] = await Promise.all([
      fetch(`/api/groups/${id}/posts`),
      fetch(`/api/groups/${id}`),
    ])
    if (postsRes.ok) setPosts(await postsRes.json())
    if (groupRes.ok) {
      const g = await groupRes.json()
      const myM = g.myMembership
      setIsMember(!!myM)
      setIsAdmin(myM?.role === 'ADMIN' || g.ownerId === session?.user?.id || session?.user?.role === 'ADMIN')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id, session])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const { url } = await res.json()
      setNewImages((prev) => [...prev, url])
    } finally { setUploading(false); if (imageRef.current) imageRef.current.value = '' }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const { url } = await res.json()
      setNewFiles((prev) => [...prev, { name: file.name, url }])
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  function addLink() {
    if (!linkInput.url.trim()) return
    const label = linkInput.label.trim() || linkInput.url.trim()
    setNewLinks((prev) => [...prev, { label, url: linkInput.url.trim() }])
    setLinkInput({ label: '', url: '' })
  }

  async function handlePost() {
    if (!newTitle.trim() || !newContent.trim()) { toast.error('제목과 내용을 입력해주세요'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          imageUrls: newImages,
          fileUrls: newFiles.map((f) => f.url),
          links: newLinks,
        }),
      })
      if (res.ok) {
        setNewTitle(''); setNewContent(''); setNewImages([]); setNewFiles([]); setNewLinks([])
        setWriting(false); load()
      } else toast.error((await res.json()).error)
    } finally { setSubmitting(false) }
  }

  async function handleDelete(postId: string) {
    const res = await fetch(`/api/groups/${id}/posts/${postId}`, { method: 'DELETE' })
    if (res.ok) setPosts((p) => p.filter((x) => x.id !== postId))
    else toast.error('삭제 실패')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/groups/${id}`} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> 그룹으로
        </Link>
        {isMember && (
          <button onClick={() => setWriting(!writing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
            <PenLine size={14} /> 글쓰기
          </button>
        )}
      </div>

      {writing && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="제목"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={5} placeholder="내용 (Markdown 지원)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none font-mono" />

          {/* 첨부 미리보기 */}
          {(newImages.length > 0 || newFiles.length > 0 || newLinks.length > 0) && (
            <div className="space-y-2">
              {newImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newImages.map((url, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border border-border" />
                      <button onClick={() => setNewImages((p) => p.filter((_, k) => k !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {newFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary">
                  <FileText size={12} />
                  <span className="flex-1 truncate">{f.name}</span>
                  <button onClick={() => setNewFiles((p) => p.filter((_, k) => k !== i))} className="text-muted hover:text-red-400"><X size={10} /></button>
                </div>
              ))}
              {newLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary">
                  <Link2 size={12} />
                  <span className="flex-1 truncate text-accent">{l.label}</span>
                  <button onClick={() => setNewLinks((p) => p.filter((_, k) => k !== i))} className="text-muted hover:text-red-400"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          {/* 링크 추가 UI */}
          <div className="flex gap-2">
            <input value={linkInput.label} onChange={(e) => setLinkInput((p) => ({ ...p, label: e.target.value }))}
              placeholder="링크 이름 (선택)"
              className="w-28 bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" />
            <input value={linkInput.url} onChange={(e) => setLinkInput((p) => ({ ...p, url: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
              placeholder="https://..."
              className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" />
            <button onClick={addLink} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors">
              <Link2 size={12} /> 추가
            </button>
          </div>

          {/* 파일/이미지 업로드 버튼 */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => imageRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
              <ImageIcon size={12} /> {uploading ? '업로드 중...' : '이미지'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
              <FileText size={12} /> PDF/파일
            </button>
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={handleFileUpload} />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setWriting(false); setNewImages([]); setNewFiles([]); setNewLinks([]) }}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">취소</button>
            <button onClick={handlePost} disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-text-secondary text-sm">아직 게시글이 없습니다</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => {
            const images = parseJson<string[]>(p.imageUrls, [])
            const files = parseJson<string[]>(p.fileUrls, [])
            const links = parseJson<LinkItem[]>(p.links, [])
            const hasAttachments = images.length > 0 || files.length > 0 || links.length > 0
            return (
              <div key={p.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <button className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-2 transition-colors"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Avatar name={p.author.name} image={p.author.image} size={24} />
                    <span className="text-xs text-text-secondary">{p.author.name}</span>
                    <TierBadge points={p.author.points} />
                    <span className="font-medium text-text-primary truncate ml-2">{p.title}</span>
                    {hasAttachments && <span className="text-xs text-muted shrink-0">📎</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted">{timeAgo(p.createdAt)}</span>
                    {(session?.user?.id === p.author.id || isAdmin) && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} className="text-muted hover:text-red-400 transition-colors p-0.5">
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ChevronDown size={14} className={`text-muted transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expandedId === p.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
                    <div className="prose-content text-sm">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{p.content}</ReactMarkdown>
                    </div>
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {images.map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={url} alt="" className="max-h-64 rounded-xl border border-border object-contain" />
                        ))}
                      </div>
                    )}
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {files.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors">
                            <FileText size={12} />{url.split('/').pop()}
                          </a>
                        ))}
                      </div>
                    )}
                    {links.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {links.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-xs text-accent hover:opacity-80 transition-opacity">
                            <ExternalLink size={12} />{l.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { ProblemTierBadge } from '@/components/ui/ProblemTierBadge'
import { SUBJECTS, timeAgo, parseJsonSafe, type SubjectKey, cn } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, XCircle, Users, MessageSquare, Send, Trash2, ImagePlus, X, Star, Pencil } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Problem {
  id: string
  problemNumber: number
  title: string
  content: string
  answer: string
  subject?: string | null
  status: string
  requestedPts: number
  approvedPts?: number | null
  imageUrls: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number; role: string }
  _count: { submissions: number; solutions: number }
  userSubmission?: { answer: string; correct: boolean; createdAt: string } | null
  correctCount: number
  solveRate: number
}

interface Submission {
  id: string
  answer: string
  correct: boolean
  createdAt: string
  user: { id: string; name?: string | null; image?: string | null; points: number }
}

interface Solution {
  id: string
  content: string
  imageUrls: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
  _count: { comments: number }
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name?: string | null; image?: string | null; points: number }
}

interface SolutionWithComments extends Solution {
  comments: Comment[]
  showComments: boolean
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: '검토중', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  APPROVED: { label: '승인됨', cls: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: '반려됨', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()

  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'problem' | 'submissions' | 'solutions'>('problem')

  // Submit form
  const [myAnswer, setMyAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Admin
  const [adminPts, setAdminPts] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)

  // Submissions tab
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)

  // Solutions tab
  const [solutions, setSolutions] = useState<SolutionWithComments[]>([])
  const [solsLoading, setSolsLoading] = useState(false)
  const [newSolution, setNewSolution] = useState('')
  const [solutionImages, setSolutionImages] = useState<string[]>([])
  const [solutionSubmitting, setSolutionSubmitting] = useState(false)
  const [solutionUploading, setSolutionUploading] = useState(false)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const loadProblem = useCallback(async () => {
    const res = await fetch(`/api/problems/${id}`)
    if (res.ok) {
      const data = await res.json()
      setProblem(data)
      setAdminPts(data.approvedPts != null ? String(data.approvedPts) : '')
    } else {
      router.push('/problems')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => { loadProblem() }, [loadProblem])

  const loadSubmissions = useCallback(async () => {
    setSubsLoading(true)
    const res = await fetch(`/api/problems/${id}/submissions`)
    if (res.ok) {
      const data = await res.json()
      setSubmissions(data.submissions)
    }
    setSubsLoading(false)
  }, [id])

  const loadSolutions = useCallback(async () => {
    setSolsLoading(true)
    const res = await fetch(`/api/problems/${id}/solutions`)
    if (res.ok) {
      const data = await res.json()
      setSolutions(data.solutions.map((s: Solution) => ({ ...s, showComments: false, comments: [] })))
    }
    setSolsLoading(false)
  }, [id])

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions()
    if (activeTab === 'solutions') loadSolutions()
  }, [activeTab, loadSubmissions, loadSolutions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) { toast.error('로그인이 필요합니다'); return }
    if (!myAnswer.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/problems/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: myAnswer }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.correct) {
          toast.success(data.pointsAwarded > 0 ? `정답! +${data.pointsAwarded}pt 획득!` : '정답입니다!')
        } else {
          toast.error('오답입니다. 다시 시도해보세요!')
        }
        await loadProblem()
        setMyAnswer('')
      } else {
        const err = await res.json()
        toast.error(err.error ?? '제출 실패')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdminAction(newStatus: string) {
    setAdminLoading(true)
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          approvedPts: adminPts ? parseInt(adminPts) : undefined,
        }),
      })
      if (res.ok) {
        toast.success(newStatus === 'APPROVED' ? '승인되었습니다' : '반려되었습니다')
        await loadProblem()
      } else {
        toast.error('처리 실패')
      }
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await fetch(`/api/problems/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('삭제되었습니다'); router.push('/problems') }
    else {
      const err = await res.json()
      toast.error(err.error ?? '삭제 실패')
    }
  }

  async function handleSolutionImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setSolutionUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) { const d = await res.json(); uploaded.push(d.url) }
      }
      setSolutionImages((prev) => [...prev, ...uploaded])
    } finally { setSolutionUploading(false) }
  }

  async function handleSolutionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newSolution.trim()) return
    setSolutionSubmitting(true)
    try {
      const res = await fetch(`/api/problems/${id}/solutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newSolution, imageUrls: solutionImages }),
      })
      if (res.ok) {
        toast.success('풀이가 등록되었습니다')
        setNewSolution('')
        setSolutionImages([])
        await loadSolutions()
      } else {
        const err = await res.json()
        toast.error(err.error ?? '등록 실패')
      }
    } finally { setSolutionSubmitting(false) }
  }

  async function handleDeleteSolution(solutionId: string) {
    if (!confirm('풀이를 삭제하시겠습니까?')) return
    const res = await fetch(`/api/problems/${id}/solutions/${solutionId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('삭제되었습니다'); await loadSolutions() }
    else toast.error('삭제 실패')
  }

  async function handleLoadComments(solutionId: string) {
    const res = await fetch(`/api/problems/${id}/solutions/${solutionId}`)
    if (res.ok) {
      const data = await res.json()
      setSolutions((prev) =>
        prev.map((s) =>
          s.id === solutionId ? { ...s, comments: data.comments, showComments: !s.showComments } : s
        )
      )
    }
  }

  async function handleCommentSubmit(solutionId: string) {
    const content = commentInputs[solutionId]?.trim()
    if (!content) return
    const res = await fetch(`/api/problems/${id}/solutions/${solutionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      setCommentInputs((prev) => ({ ...prev, [solutionId]: '' }))
      // Reload comments
      const r = await fetch(`/api/problems/${id}/solutions/${solutionId}`)
      if (r.ok) {
        const data = await r.json()
        setSolutions((prev) =>
          prev.map((s) => s.id === solutionId ? { ...s, comments: data.comments } : s)
        )
      }
    } else toast.error('댓글 등록 실패')
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />)}
    </div>
  )

  if (!problem) return null

  const images = parseJsonSafe<string[]>(problem.imageUrls, [])
  const subjectInfo = problem.subject ? SUBJECTS[problem.subject as SubjectKey] : null
  const status = STATUS_LABELS[problem.status] ?? STATUS_LABELS.PENDING
  const isAdmin = session?.user?.role === 'ADMIN'
  const isAuthor = session?.user?.id === problem.author.id
  const canDelete = isAdmin || (isAuthor && problem.status === 'PENDING')
  const alreadySolved = problem.userSubmission?.correct === true

  const TABS = [
    { key: 'problem', label: '문제' },
    { key: 'submissions', label: `채점현황 (${problem._count.submissions})` },
    { key: 'solutions', label: `풀이 (${problem._count.solutions})` },
  ] as const

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/problems" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        문제 목록
      </Link>

      {/* Problem header */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-semibold text-accent">#{problem.problemNumber}</span>
              {subjectInfo && (
                <span className="text-xs px-2 py-0.5 rounded border border-border text-text-secondary">{subjectInfo.label}</span>
              )}
              <span className={cn('text-xs px-2 py-0.5 rounded border', status.cls)}>{status.label}</span>
              {problem.approvedPts != null && problem.approvedPts > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                  <ProblemTierBadge pts={problem.approvedPts} size="md" />
                  <Star size={11} className="fill-current" />
                  {problem.approvedPts}pt
                </span>
              )}
              {alreadySolved && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                  <CheckCircle2 size={12} />
                  맞춤
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-text-primary">{problem.title}</h1>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {isAdmin && (
              <Link
                href={`/problems/${id}/edit`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-accent hover:bg-accent/5 border border-transparent hover:border-accent/20 transition-all"
              >
                <Pencil size={13} />
                수정
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-red-400 hover:bg-red-400/5 border border-transparent hover:border-red-400/20 transition-all"
              >
                <Trash2 size={13} />
                삭제
              </button>
            )}
          </div>
        </div>

        {/* Author */}
        <div className="flex items-center gap-2 pb-4 border-b border-border">
          <Avatar name={problem.author.name} image={problem.author.image} size={28} />
          <span className="text-sm text-text-primary">{problem.author.name}</span>
          <TierBadge points={problem.author.points} />
          <span className="text-xs text-muted">{timeAgo(problem.createdAt)}</span>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1"><Users size={11} />{problem._count.submissions}명 도전</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={11} />{problem.solveRate}% 정답</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                activeTab === key
                  ? 'text-accent border-accent bg-accent/5'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===== 문제 tab ===== */}
        {activeTab === 'problem' && (
          <div className="space-y-5 pt-1">
            {/* Content */}
            <div className="prose-content">
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                {problem.content}
              </ReactMarkdown>
            </div>

            {/* Images */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="문제 이미지" className="max-h-64 rounded-lg border border-border object-contain" />
                ))}
              </div>
            )}

            {/* Submit form */}
            {problem.status === 'APPROVED' && (
              <div className="pt-4 border-t border-border space-y-3">
                {alreadySolved ? (
                  <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                    <CheckCircle2 size={18} />
                    <div>
                      <p className="font-semibold text-sm">정답을 맞혔습니다!</p>
                      {problem.userSubmission && (
                        <p className="text-xs mt-0.5 opacity-75">제출한 답: {problem.userSubmission.answer}</p>
                      )}
                    </div>
                  </div>
                ) : problem.userSubmission ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <XCircle size={16} />
                    <p className="text-sm">마지막 제출: <strong>{problem.userSubmission.answer}</strong> — 오답</p>
                  </div>
                ) : null}

                {!alreadySolved && session?.user && (
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                      value={myAnswer}
                      onChange={(e) => setMyAnswer(e.target.value)}
                      placeholder="답을 입력하세요..."
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !myAnswer.trim()}
                      className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={13} />
                      {submitting ? '제출 중...' : '제출'}
                    </button>
                  </form>
                )}

                {!session?.user && (
                  <p className="text-sm text-text-secondary text-center">
                    <Link href="/login" className="text-accent hover:underline">로그인</Link>하여 답을 제출하세요
                  </p>
                )}
              </div>
            )}

            {/* Admin panel */}
            {isAdmin && (
              <div className="pt-4 border-t border-border space-y-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">관리자 패널</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-text-secondary">승인 점수:</label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={adminPts}
                      onChange={(e) => setAdminPts(e.target.value)}
                      placeholder={`요청: ${problem.requestedPts}pt`}
                      className="w-24 bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
                    />
                    <span className="text-sm text-text-secondary">pt</span>
                  </div>
                  <button
                    onClick={() => handleAdminAction('APPROVED')}
                    disabled={adminLoading || problem.status === 'APPROVED'}
                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleAdminAction('REJECTED')}
                    disabled={adminLoading || problem.status === 'REJECTED'}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => handleAdminAction('PENDING')}
                    disabled={adminLoading || problem.status === 'PENDING'}
                    className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    검토중으로 변경
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 채점현황 tab ===== */}
        {activeTab === 'submissions' && (
          <div className="space-y-3 pt-1">
            {subsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-surface-2 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : submissions.length > 0 ? (
              <div className="space-y-2">
                {submissions.map((sub) => {
                  const isMe = sub.user.id === session?.user?.id
                  return (
                    <div
                      key={sub.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border',
                        isMe ? 'border-accent/30 bg-accent/5' : 'border-border bg-background'
                      )}
                    >
                      {sub.correct
                        ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                        : <XCircle size={16} className="text-red-400 shrink-0" />
                      }
                      <Avatar name={sub.user.name} image={sub.user.image} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-text-primary">{sub.user.name}</span>
                          {isMe && <span className="text-xs text-accent">(나)</span>}
                          <TierBadge points={sub.user.points} />
                        </div>
                      </div>
                      <span className="text-xs text-muted shrink-0">{timeAgo(sub.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-text-secondary text-center py-8">아직 제출이 없습니다</p>
            )}
          </div>
        )}

        {/* ===== 풀이 tab ===== */}
        {activeTab === 'solutions' && (
          <div className="space-y-5 pt-1">
            {/* Add solution form */}
            {session?.user && (
              <form onSubmit={handleSolutionSubmit} className="space-y-3 p-4 bg-background border border-border rounded-xl">
                <p className="text-sm font-medium text-text-primary">풀이 작성</p>
                <textarea
                  value={newSolution}
                  onChange={(e) => setNewSolution(e.target.value)}
                  placeholder="풀이 내용을 작성하세요. 마크다운과 $수식$ 사용 가능"
                  rows={5}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-y font-mono"
                />
                {solutionImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {solutionImages.map((url) => (
                      <div key={url} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                        <button
                          type="button"
                          onClick={() => setSolutionImages((p) => p.filter((u) => u !== url))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-accent hover:border-accent/40 cursor-pointer transition-colors">
                    <ImagePlus size={13} />
                    이미지
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleSolutionImageUpload} disabled={solutionUploading} />
                  </label>
                  <button
                    type="submit"
                    disabled={solutionSubmitting || !newSolution.trim()}
                    className="ml-auto px-4 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                  >
                    {solutionSubmitting ? '등록 중...' : '풀이 등록'}
                  </button>
                </div>
              </form>
            )}

            {/* Solutions list */}
            {solsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 bg-surface-2 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : solutions.length > 0 ? (
              <div className="space-y-4">
                {solutions.map((sol) => {
                  const solImages = parseJsonSafe<string[]>(sol.imageUrls, [])
                  const canDeleteSol = session?.user?.id === sol.author.id || isAdmin
                  return (
                    <div key={sol.id} className="border border-border rounded-xl overflow-hidden">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar name={sol.author.name} image={sol.author.image} size={24} />
                            <span className="text-sm font-medium text-text-primary">{sol.author.name}</span>
                            <TierBadge points={sol.author.points} />
                            <span className="text-xs text-muted">{timeAgo(sol.createdAt)}</span>
                          </div>
                          {canDeleteSol && (
                            <button
                              onClick={() => handleDeleteSolution(sol.id)}
                              className="text-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <div className="prose-content">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {sol.content}
                          </ReactMarkdown>
                        </div>
                        {solImages.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {solImages.map((url) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={url} src={url} alt="" className="max-h-48 rounded-lg border border-border" />
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => handleLoadComments(sol.id)}
                          className="flex items-center gap-1.5 text-xs text-muted hover:text-text-secondary transition-colors"
                        >
                          <MessageSquare size={12} />
                          댓글 {sol._count.comments}개
                          {sol.showComments ? ' ▲' : ' ▼'}
                        </button>
                      </div>

                      {/* Comments */}
                      {sol.showComments && (
                        <div className="border-t border-border bg-background p-4 space-y-3">
                          {sol.comments.map((c) => (
                            <div key={c.id} className="flex items-start gap-2">
                              <Avatar name={c.author.name} image={c.author.image} size={20} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-medium text-text-primary">{c.author.name}</span>
                                  <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
                                </div>
                                <p className="text-sm text-text-secondary">{c.content}</p>
                              </div>
                            </div>
                          ))}
                          {session?.user && (
                            <div className="flex gap-2 pt-1">
                              <input
                                value={commentInputs[sol.id] ?? ''}
                                onChange={(e) => setCommentInputs((p) => ({ ...p, [sol.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(sol.id) } }}
                                placeholder="댓글 입력..."
                                className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                              />
                              <button
                                onClick={() => handleCommentSubmit(sol.id)}
                                disabled={!commentInputs[sol.id]?.trim()}
                                className="px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                              >
                                <Send size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-text-secondary text-center py-8">
                아직 풀이가 없습니다. 첫 번째 풀이를 작성해보세요!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

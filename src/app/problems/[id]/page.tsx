'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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
import { ArrowLeft, CheckCircle2, XCircle, Users, MessageSquare, Send, Trash2, ImagePlus, X, Star, Pencil, Download, Lock, FileText, CheckCheck, Bookmark, BookmarkCheck } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface SubAnswerDef {
  label: string
  answer: string
  extra?: string[]
}

interface Problem {
  id: string
  problemNumber: number
  title: string
  content: string
  answer: string
  extraAnswers?: string
  subAnswers?: string
  subject?: string | null
  status: string
  requestedPts: number
  approvedPts?: number | null
  imageUrls: string
  contestId?: string | null
  isEssay?: boolean
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
  const [backHref, setBackHref] = useState('/problems')
  const [backLabel, setBackLabel] = useState('문제 목록')
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from')
    if (from) { setBackHref(from); setBackLabel('문제집으로') }
  }, [])

  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'problem' | 'submissions' | 'solutions' | 'essay_review'>('problem')

  // Submit form
  const [myAnswer, setMyAnswer] = useState('')
  const [myParts, setMyParts] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Admin
  const [adminPts, setAdminPts] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)

  // Bookmark
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)

  // Difficulty vote
  const [diffAvg, setDiffAvg] = useState<number | null>(null)
  const [diffCount, setDiffCount] = useState(0)
  const [myDiffVote, setMyDiffVote] = useState<number | null>(null)
  const [diffVoting, setDiffVoting] = useState(false)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  // Submissions tab
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)

  // Solutions tab
  const [solutions, setSolutions] = useState<SolutionWithComments[]>([])
  const [solsLoading, setSolsLoading] = useState(false)
  const [newSolution, setNewSolution] = useState('')
  const [solutionSubmitting, setSolutionSubmitting] = useState(false)
  const [solutionUploading, setSolutionUploading] = useState(false)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null)
  const [editSolutionContent, setEditSolutionContent] = useState('')
  const [editSolutionSaving, setEditSolutionSaving] = useState(false)
  const solutionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const editSolutionRef = useRef<HTMLTextAreaElement>(null)

  // Essay submission state
  const [essayContent, setEssayContent] = useState('')
  const [essayImages, setEssayImages] = useState<string[]>([])
  const [essaySubmitting, setEssaySubmitting] = useState(false)
  const [myEssaySub, setMyEssaySub] = useState<{ status: string; content: string } | null>(null)
  const [essayReviews, setEssayReviews] = useState<{ id: string; content: string; imageUrls: string; status: string; createdAt: string; user: { id: string; name?: string | null; image?: string | null; points: number } }[]>([])
  const [essayReviewLoading, setEssayReviewLoading] = useState(false)
  const essayFileRef = useRef<HTMLInputElement>(null)
  const essayUploadRef = useRef<boolean>(false)

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

  useEffect(() => {
    loadProblem().then(async () => {
      if (session?.user) {
        // 에세이 제출 로드
        try {
          const res = await fetch(`/api/problems/${id}/essay`)
          if (res.ok) {
            const d = await res.json()
            if (d.mySubmission) setMyEssaySub({ status: d.mySubmission.status, content: d.mySubmission.content })
          }
        } catch { /* ignore */ }
      }
    })
    // 북마크 + 난이도 로드 (비로그인도 평균은 볼 수 있음)
    fetch(`/api/problems/${id}/difficulty-vote`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setDiffAvg(d.avg); setDiffCount(d.count); setMyDiffVote(d.myVote) }
    }).catch(() => {})
    // 북마크 상태 로드
    if (session?.user) {
      fetch(`/api/problems/${id}/bookmark`).then(r => r.ok ? r.json() : null).then(d => {
        if (d) setBookmarked(d.bookmarked)
      }).catch(() => {})
    }
  }, [loadProblem, id, session?.user])

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
      setSolutions((data.solutions ?? []).map((s: Solution) => ({ ...s, showComments: false, comments: [] })))
    }
    setSolsLoading(false)
  }, [id])

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions()
    if (activeTab === 'solutions') loadSolutions()
    if (activeTab === 'essay_review') loadEssayReviews()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadSubmissions, loadSolutions])

  async function handleEssaySubmit() {
    if (!essayContent.trim() && essayImages.length === 0) { toast.error('답안 내용 또는 이미지를 첨부하세요'); return }
    setEssaySubmitting(true)
    try {
      const res = await fetch(`/api/problems/${id}/essay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: essayContent, imageUrls: essayImages }),
      })
      if (res.ok) {
        toast.success('서술형 답안이 제출되었습니다')
        setMyEssaySub({ status: 'PENDING', content: essayContent })
        setEssayContent('')
        setEssayImages([])
      } else toast.error((await res.json()).error ?? '제출 실패')
    } finally { setEssaySubmitting(false) }
  }

  async function handleEssayImageUpload(file: File) {
    if (essayUploadRef.current) return
    essayUploadRef.current = true
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const { url } = await res.json()
      setEssayImages(prev => [...prev, url])
    } finally { essayUploadRef.current = false }
  }

  async function loadEssayReviews() {
    setEssayReviewLoading(true)
    try {
      const res = await fetch(`/api/problems/${id}/essay`)
      if (res.ok) { const d = await res.json(); setEssayReviews(d.submissions ?? []) }
    } finally { setEssayReviewLoading(false) }
  }

  async function handleEssayReviewAction(submissionId: string, status: 'APPROVED' | 'REJECTED') {
    const res = await fetch(`/api/problems/${id}/essay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, status }),
    })
    if (res.ok) { toast.success(status === 'APPROVED' ? '승인되었습니다' : '반려되었습니다'); await loadEssayReviews(); await loadProblem() }
    else toast.error('처리 실패')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) { toast.error('로그인이 필요합니다'); return }

    const subAnswerDefs = parseJsonSafe<SubAnswerDef[]>(problem?.subAnswers ?? '[]', [])
    const isMultiPart = subAnswerDefs.length > 0

    if (isMultiPart) {
      if (myParts.some((p) => !p?.trim())) { toast.error('모든 답을 입력해주세요'); return }
    } else {
      if (!myAnswer.trim()) return
    }

    setSubmitting(true)
    try {
      const body = isMultiPart ? { parts: myParts } : { answer: myAnswer }
      const res = await fetch(`/api/problems/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.correct) {
          if (data.isSelfSolve) {
            toast.success('정답입니다! (출제자는 자신의 문제에서 포인트를 받을 수 없습니다)')
          } else {
            toast.success(data.pointsAwarded > 0 ? `정답! +${data.pointsAwarded}pt 획득!` : '정답입니다!')
          }
        } else {
          toast.error('오답입니다. 다시 시도해보세요!')
        }
        await loadProblem()
        setMyAnswer('')
        setMyParts([])
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

  function insertSolutionImageAtCursor(url: string, name: string) {
    const ta = solutionTextareaRef.current
    const insert = `![${name}](${url})`
    if (!ta) {
      setNewSolution((c) => c + '\n' + insert + '\n')
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    setNewSolution((c) => c.slice(0, start) + insert + c.slice(end))
    // Restore cursor position after React re-render
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + insert.length
      ta.focus()
    }, 0)
  }

  async function handleSolutionImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    // Reset input so same file can be re-selected
    e.target.value = ''
    setSolutionUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const d = await res.json()
          insertSolutionImageAtCursor(d.url, d.name ?? file.name)
        }
      }
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
        body: JSON.stringify({ content: newSolution, imageUrls: [] }),
      })
      if (res.ok) {
        toast.success('풀이가 등록되었습니다')
        setNewSolution('')
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

  async function handleSolutionEdit(solutionId: string) {
    if (!editSolutionContent.trim()) return
    setEditSolutionSaving(true)
    try {
      const res = await fetch(`/api/problems/${id}/solutions/${solutionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editSolutionContent, imageUrls: [] }),
      })
      if (res.ok) {
        toast.success('풀이가 수정되었습니다')
        setEditingSolutionId(null)
        await loadSolutions()
      } else toast.error('수정 실패')
    } finally { setEditSolutionSaving(false) }
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
  const subAnswerDefs = parseJsonSafe<SubAnswerDef[]>(problem.subAnswers ?? '[]', [])
  const isMultiPart = subAnswerDefs.length > 0
  const subjectInfo = problem.subject ? SUBJECTS[problem.subject as SubjectKey] : null
  const status = STATUS_LABELS[problem.status] ?? STATUS_LABELS.PENDING
  const isAdmin = session?.user?.role === 'ADMIN'
  const isAuthor = session?.user?.id === problem.author.id
  const canDelete = isAdmin
  const canEdit = isAdmin || isAuthor
  const alreadySolved = problem.userSubmission?.correct === true
  // 풀이 탭 잠금: 정답을 맞춰야 볼 수 있음 (어드민·출제자 제외)
  const solutionsLocked = !alreadySolved && !isAdmin && !isAuthor

  const TABS: { key: 'problem' | 'submissions' | 'solutions' | 'essay_review'; label: string }[] = [
    { key: 'problem', label: '문제' },
    { key: 'submissions', label: `채점현황 (${problem._count.submissions})` },
    { key: 'solutions', label: `풀이 (${problem._count.solutions})` },
    ...(problem.isEssay && (isAdmin || isAuthor) ? [{ key: 'essay_review' as const, label: '서술형 검토' }] : []),
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        {backLabel}
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
              {problem.isEssay && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-blue-300/60 text-blue-600 bg-blue-50/40">
                  <FileText size={10} /> 서술형
                </span>
              )}
              {problem.contestId && (
                <Link href={`/contests/${problem.contestId}`}
                  className="text-xs px-2 py-0.5 rounded border border-violet-400/40 text-violet-500 bg-violet-50/30 hover:bg-violet-100/40 transition-colors">
                  🏆 대회 출제
                </Link>
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
            {/* 북마크 버튼 */}
            {session?.user && (
              <button
                onClick={async () => {
                  setBookmarkLoading(true)
                  try {
                    const res = await fetch(`/api/problems/${id}/bookmark`, { method: 'POST' })
                    if (res.ok) {
                      const d = await res.json()
                      setBookmarked(d.bookmarked)
                      toast.success(d.bookmarked ? '북마크에 저장했습니다' : '북마크를 해제했습니다')
                    }
                  } catch { toast.error('오류가 발생했습니다') }
                  setBookmarkLoading(false)
                }}
                disabled={bookmarkLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${bookmarked ? 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'text-muted hover:text-amber-500 hover:bg-amber-500/5 border-transparent hover:border-amber-500/20'}`}
              >
                {bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                {bookmarked ? '저장됨' : '저장'}
              </button>
            )}
            {canEdit && (
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

        {/* 체감 난이도 */}
        <div className="flex items-center gap-3 py-1">
          <span className="text-xs text-muted shrink-0">체감 난이도</span>
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map((star) => {
              const filled = (hoveredStar ?? myDiffVote ?? 0) >= star
              const avgFilled = !hoveredStar && !myDiffVote && diffAvg !== null && diffAvg >= star - 0.5
              return (
                <button key={star}
                  onMouseEnter={() => session?.user && problem.userSubmission?.correct && setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  onClick={async () => {
                    if (!session?.user) { toast.error('로그인이 필요합니다'); return }
                    if (!problem.userSubmission?.correct) { toast.error('문제를 먼저 풀어야 평가할 수 있습니다'); return }
                    setDiffVoting(true)
                    try {
                      const res = await fetch(`/api/problems/${id}/difficulty-vote`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ difficulty: star }),
                      })
                      if (res.ok) {
                        const d = await res.json()
                        setMyDiffVote(d.myVote); setDiffAvg(d.avg); setDiffCount(d.count)
                        toast.success('난이도를 평가했습니다')
                      }
                    } catch { toast.error('오류가 발생했습니다') }
                    setDiffVoting(false)
                  }}
                  disabled={diffVoting}
                  className="transition-transform hover:scale-110">
                  <Star size={16} className={`transition-colors ${filled || avgFilled ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
                </button>
              )
            })}
          </div>
          {diffAvg !== null ? (
            <span className="text-xs text-muted">{diffAvg.toFixed(1)} <span className="text-muted/60">({diffCount}명)</span></span>
          ) : (
            <span className="text-xs text-muted/50">아직 평가 없음</span>
          )}
          {myDiffVote && <span className="text-xs text-amber-500 ml-1">내 평가: ★{myDiffVote}</span>}
          {!problem.userSubmission?.correct && session?.user && (
            <span className="text-xs text-muted/50 ml-auto">풀고 나면 평가 가능</span>
          )}
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
              <div className="flex flex-wrap gap-2 pt-2">
                {images.map((url) => (
                  <div key={url} className="relative group inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="첨부 이미지" className="max-h-24 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
                    <a
                      href={url}
                      download
                      className="absolute bottom-1 right-1 w-5 h-5 bg-black/60 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="다운로드"
                    >
                      <Download size={10} />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Essay submission form */}
            {problem.status === 'APPROVED' && problem.isEssay && (
              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-accent" />
                  <p className="text-sm font-semibold text-text-primary">서술형 답안 제출</p>
                </div>
                {myEssaySub && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${myEssaySub.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-700' : myEssaySub.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                    {myEssaySub.status === 'APPROVED' ? <CheckCheck size={15} /> : myEssaySub.status === 'REJECTED' ? <XCircle size={15} /> : <FileText size={15} />}
                    <span>
                      {myEssaySub.status === 'APPROVED' ? '답안이 승인되었습니다!' : myEssaySub.status === 'REJECTED' ? '답안이 반려되었습니다. 다시 제출해보세요.' : '답안 검토 중입니다.'}
                    </span>
                  </div>
                )}
                {(!myEssaySub || myEssaySub.status === 'REJECTED') && session?.user && (
                  <div className="space-y-3">
                    <textarea
                      value={essayContent}
                      onChange={(e) => setEssayContent(e.target.value)}
                      placeholder="서술형 답안을 작성하세요..."
                      rows={5}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-y"
                    />
                    {essayImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {essayImages.map((url, i) => (
                          <div key={url} className="relative group inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="max-h-20 rounded-lg border border-border object-contain" />
                            <button
                              onClick={() => setEssayImages(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            ><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-accent hover:border-accent/40 cursor-pointer transition-colors">
                        <ImagePlus size={13} /> 이미지 첨부
                        <input
                          ref={essayFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEssayImageUpload(f); if (e.target) e.target.value = '' }}
                        />
                      </label>
                      <button
                        onClick={handleEssaySubmit}
                        disabled={essaySubmitting || (!essayContent.trim() && essayImages.length === 0)}
                        className="ml-auto px-4 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Send size={13} />
                        {essaySubmitting ? '제출 중...' : '서술형 제출'}
                      </button>
                    </div>
                  </div>
                )}
                {!session?.user && (
                  <p className="text-sm text-text-secondary text-center">
                    <Link href="/login" className="text-accent hover:underline">로그인</Link>하여 답을 제출하세요
                  </p>
                )}
              </div>
            )}

            {/* Submit form (non-essay) */}
            {problem.status === 'APPROVED' && !problem.isEssay && (
              <div className="pt-4 border-t border-border space-y-3">
                {alreadySolved ? (
                  <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                    <CheckCircle2 size={18} />
                    <div>
                      <p className="font-semibold text-sm">정답을 맞혔습니다!</p>
                      {problem.userSubmission && (
                        <p className="text-xs mt-0.5 opacity-75">
                          {isMultiPart
                            ? (() => {
                                try {
                                  const parts: string[] = JSON.parse(problem.userSubmission.answer)
                                  return subAnswerDefs.map((def, i) => `${def.label}: ${parts[i] ?? ''}`).join(' / ')
                                } catch {
                                  return problem.userSubmission.answer
                                }
                              })()
                            : `제출한 답: ${problem.userSubmission.answer}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                ) : problem.userSubmission ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <XCircle size={16} />
                    <p className="text-sm">마지막 제출: <strong>
                      {isMultiPart
                        ? (() => {
                            try {
                              const parts: string[] = JSON.parse(problem.userSubmission.answer)
                              return subAnswerDefs.map((def, i) => `${def.label}: ${parts[i] ?? ''}`).join(' / ')
                            } catch {
                              return problem.userSubmission.answer
                            }
                          })()
                        : problem.userSubmission.answer
                      }
                    </strong> — 오답</p>
                  </div>
                ) : null}

                {!alreadySolved && session?.user && (
                  <form onSubmit={handleSubmit} className="space-y-2">
                    {isMultiPart ? (
                      <div className="space-y-2">
                        {subAnswerDefs.map((def, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-text-secondary w-10 shrink-0">{def.label}</span>
                            <input
                              value={myParts[i] ?? ''}
                              onChange={(e) => {
                                const next = [...myParts]
                                next[i] = e.target.value
                                setMyParts(next)
                              }}
                              placeholder={`${def.label} 답 입력`}
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                            />
                          </div>
                        ))}
                        <button
                          type="submit"
                          disabled={submitting || myParts.length !== subAnswerDefs.length || myParts.some((p) => !p?.trim())}
                          className="w-full px-4 py-2 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Send size={13} />
                          {submitting ? '제출 중...' : '모두 제출'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
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
                      </div>
                    )}
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
                {isMultiPart && (
                  <div className="p-3 bg-surface-2 rounded-lg text-xs space-y-1">
                    <p className="font-medium text-text-secondary">다중 필수 답변:</p>
                    {subAnswerDefs.map((def, i) => (
                      <p key={i} className="text-text-secondary">
                        <span className="font-mono text-accent">{def.label}</span>: {def.answer}
                        {def.extra && def.extra.length > 0 && (
                          <span className="text-muted"> ({def.extra.join(', ')})</span>
                        )}
                      </p>
                    ))}
                  </div>
                )}
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

        {/* ===== 서술형 검토 tab ===== */}
        {activeTab === 'essay_review' && (isAdmin || isAuthor) && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-secondary">서술형 답안 검토</p>
              <button onClick={loadEssayReviews} disabled={essayReviewLoading} className="text-xs text-accent hover:underline disabled:opacity-50">새로고침</button>
            </div>
            {essayReviewLoading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-surface-2 rounded-xl animate-pulse" />)}</div>
            ) : essayReviews.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-8">제출된 서술형 답안이 없습니다</p>
            ) : (
              <div className="space-y-4">
                {essayReviews.map((sub) => {
                  const subImages: string[] = (() => { try { return JSON.parse(sub.imageUrls) } catch { return [] } })()
                  return (
                    <div key={sub.id} className={`border rounded-2xl p-4 space-y-3 ${sub.status === 'APPROVED' ? 'border-green-300' : sub.status === 'REJECTED' ? 'border-red-300' : 'border-border'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={sub.user.name} image={sub.user.image} size={26} />
                          <span className="text-sm font-medium text-text-primary">{sub.user.name}</span>
                          <TierBadge points={sub.user.points} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${sub.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : sub.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {sub.status === 'APPROVED' ? '승인' : sub.status === 'REJECTED' ? '반려' : '검토 중'}
                          </span>
                          <span className="text-xs text-muted">{timeAgo(sub.createdAt)}</span>
                        </div>
                      </div>
                      {sub.content && <p className="text-sm text-text-primary whitespace-pre-wrap bg-background border border-border rounded-lg p-3">{sub.content}</p>}
                      {subImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {subImages.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" className="max-h-32 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <button
                          onClick={() => handleEssayReviewAction(sub.id, 'APPROVED')}
                          disabled={sub.status === 'APPROVED'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors disabled:opacity-40"
                        >
                          <CheckCheck size={12} /> 승인{problem.approvedPts && problem.approvedPts > 0 ? ` (+${problem.approvedPts}pt)` : ''}
                        </button>
                        <button
                          onClick={() => handleEssayReviewAction(sub.id, 'REJECTED')}
                          disabled={sub.status === 'REJECTED'}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-40"
                        >
                          <XCircle size={12} /> 반려
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== 풀이 tab ===== */}
        {activeTab === 'solutions' && (
          <div className="space-y-5 pt-1">
            {/* Locked state */}
            {solutionsLocked && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
                  <Lock size={22} className="text-muted" />
                </div>
                <p className="text-sm font-medium text-text-secondary">정답을 맞춰야 풀이를 볼 수 있습니다</p>
                <p className="text-xs text-muted">문제를 직접 풀고 정답을 제출해보세요!</p>
              </div>
            )}
            {/* Add solution form */}
            {!solutionsLocked && session?.user && (
              <form onSubmit={handleSolutionSubmit} className="space-y-3 p-4 bg-background border border-border rounded-xl">
                <p className="text-sm font-medium text-text-primary">풀이 작성</p>
                <textarea
                  ref={solutionTextareaRef}
                  value={newSolution}
                  onChange={(e) => setNewSolution(e.target.value)}
                  placeholder="풀이 내용을 작성하세요. 마크다운과 $수식$ 사용 가능&#10;이미지는 아래 버튼으로 커서 위치에 삽입됩니다"
                  rows={5}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent resize-y font-mono"
                />
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs cursor-pointer transition-colors ${solutionUploading ? 'opacity-50 cursor-not-allowed' : 'text-text-secondary hover:text-accent hover:border-accent/40'}`}>
                    <ImagePlus size={13} />
                    {solutionUploading ? '업로드 중...' : '이미지 삽입'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleSolutionImageUpload} disabled={solutionUploading} />
                  </label>
                  <span className="text-xs text-muted">커서 위치에 이미지가 삽입됩니다</span>
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
            {!solutionsLocked && (solsLoading ? (
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
                  const canEditSol = session?.user?.id === sol.author.id || isAdmin
                  const isEditingThis = editingSolutionId === sol.id
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
                          <div className="flex items-center gap-1">
                            {canEditSol && !isEditingThis && (
                              <button
                                onClick={() => {
                                  setEditingSolutionId(sol.id)
                                  setEditSolutionContent(sol.content)
                                  setTimeout(() => editSolutionRef.current?.focus(), 50)
                                }}
                                className="text-muted hover:text-accent transition-colors p-1"
                                title="풀이 수정"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {canDeleteSol && (
                              <button
                                onClick={() => handleDeleteSolution(sol.id)}
                                className="text-muted hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditingThis ? (
                          <div className="space-y-2">
                            <textarea
                              ref={editSolutionRef}
                              value={editSolutionContent}
                              onChange={(e) => setEditSolutionContent(e.target.value)}
                              rows={6}
                              className="w-full bg-surface border border-accent/40 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y font-mono"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setEditingSolutionId(null)}
                                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleSolutionEdit(sol.id)}
                                disabled={editSolutionSaving || !editSolutionContent.trim()}
                                className="px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                              >
                                {editSolutionSaving ? '저장 중...' : '저장'}
                              </button>
                            </div>
                          </div>
                        ) : (
                        <div className="prose-content">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {sol.content}
                          </ReactMarkdown>
                        </div>
                        )}
                        {solImages.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {solImages.map((url) => (
                              <div key={url} className="relative group inline-block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="max-h-20 rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
                                <a
                                  href={url}
                                  download
                                  className="absolute bottom-1 right-1 w-5 h-5 bg-black/60 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="다운로드"
                                >
                                  <Download size={10} />
                                </a>
                              </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

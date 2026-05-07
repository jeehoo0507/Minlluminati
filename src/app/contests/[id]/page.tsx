'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { timeAgo } from '@/lib/utils'
import { Clock, Users, CheckCircle, Play, Pencil, X, Save, Send, MessageSquare, Plus, ImagePlus, RefreshCw, Ban, UserPlus, Eye, PenLine, Trash2, Download, GripVertical, FileText, CheckCheck, XCircle, Image as ImageIcon } from 'lucide-react'
import { ImageCropper } from '@/components/ui/ImageCropper'
import toast from 'react-hot-toast'

interface SubAnswerDef { label: string; answer: string; extra?: string[] }
interface Problem { id: string; label: string; title: string; content: string; answer?: string; extraAnswers?: string[]; subAnswers?: SubAnswerDef[]; points: number; imageUrls?: string[]; allowRetry?: boolean; isEssay?: boolean }
interface Contributor { id: string; userId: string; role: string; user: { id: string; name?: string | null; image?: string | null; points: number } }
interface ChatMsg { id: string; content: string; createdAt: string; author: { id: string; name?: string | null; image?: string | null } }
interface EssaySub { id: string; content: string; imageUrls: string; status: string; createdAt: string; user: { id: string; name?: string | null; image?: string | null; points: number }; problem: { id: string; label: string; title: string } }
interface ContestTeamMember { id: string; userId: string; user: { id: string; name?: string | null; image?: string | null; points: number }; joinedAt: string }
interface ContestTeam { id: string; contestId: string; name: string; description: string; leaderId: string; score: number; members: ContestTeamMember[]; leader: { id: string; name?: string | null; image?: string | null; points: number }; createdAt: string }

interface Contest {
  id: string; title: string; description: string; rules: string; status: string
  bannerUrl?: string | null
  startTime: string | null; durationMin: number; organizerId: string
  prize1?: number | null; prize2?: number | null; prize3?: number | null
  teamContest?: boolean; teamSize?: number
  organizer: { id: string; name?: string | null; image?: string | null; points: number }
  contributors: Contributor[]
  problems: Problem[]; _count: { participants: number }
  myParticipant: { id: string } | null
  mySubmissions: Record<string, boolean>
}

export default function ContestPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const [contest, setContest] = useState<Contest | null>(null)
  const [leaderboard, setLeaderboard] = useState<{ rank: number; user: { id: string; name?: string | null; image?: string | null; points: number }; score: number; solvedProblems: { problem: { label: string; title: string } }[] }[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [parts, setParts] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'problems' | 'leaderboard' | 'info' | 'chat' | 'essay'>('problems')
  const [essayFilterProblem, setEssayFilterProblem] = useState<string>('all')
  const [editingProblem, setEditingProblem] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Problem>>({})
  const [saving, setSaving] = useState(false)
  const [chats, setChats] = useState<ChatMsg[]>([])
  const [chatMsg, setChatMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [teamChats, setTeamChats] = useState<ChatMsg[]>([])
  const [teamChatMsg, setTeamChatMsg] = useState('')
  const [teamChatLoading, setTeamChatLoading] = useState(false)
  const [chatSubTab, setChatSubTab] = useState<'global' | 'team'>('global')
  const [uploadingProblem, setUploadingProblem] = useState<string | null>(null)
  const [editPreview, setEditPreview] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoDraft, setInfoDraft] = useState({ title: '', description: '', rules: '', durationMin: 120, prize1: '' as string, prize2: '' as string, prize3: '' as string, contribs: [] as { userId: string; query: string; role: 'CONTRIBUTOR' | 'REVIEWER' }[], bannerUrl: null as string | null })
  const [savingInfo, setSavingInfo] = useState(false)
  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerFileRef = useRef<HTMLInputElement>(null)
  const [addingProblem, setAddingProblem] = useState(false)
  const [newProblem, setNewProblem] = useState({ title: '', content: '', answer: '', extraAnswers: [] as string[], subAnswers: [{ label: '(1)', answer: '', extra: [] as string[] }] as SubAnswerDef[], multiPartMode: false, isEssay: false, points: 100, allowRetry: true })
  const [savingNewProblem, setSavingNewProblem] = useState(false)
  const [deletingProblem, setDeletingProblem] = useState<string | null>(null)
  const [newContribQuery, setNewContribQuery] = useState('')
  const [newContribRole, setNewContribRole] = useState<'CONTRIBUTOR' | 'REVIEWER'>('CONTRIBUTOR')
  // 서술형
  const [essayInputs, setEssayInputs] = useState<Record<string, string>>({})
  const [essayImages, setEssayImages] = useState<Record<string, string[]>>({})
  const [submittingEssay, setSubmittingEssay] = useState<string | null>(null)
  const [essayReviews, setEssayReviews] = useState<EssaySub[]>([])
  const [essayReviewLoading, setEssayReviewLoading] = useState(false)
  const essayFileRef = useRef<HTMLInputElement>(null)
  const essayUploadPidRef = useRef<string>('')
  // Team contest
  const [teams, setTeams] = useState<ContestTeam[]>([])
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // 드래그 순서
  const [dragOverPid, setDragOverPid] = useState<string | null>(null)
  const dragPidRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)

  const loadTeams = useCallback(async () => {
    const res = await fetch(`/api/contests/${id}/teams`)
    if (res.ok) setTeams(await res.json())
  }, [id])

  const load = useCallback(async () => {
    const res = await fetch(`/api/contests/${id}`)
    if (res.ok) {
      const data = await res.json()
      setContest(data)
      if (data.teamContest) loadTeams()
    }
    setLoading(false)
  }, [id, loadTeams])

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch(`/api/contests/${id}/leaderboard`)
    if (res.ok) setLeaderboard(await res.json())
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (contest?.status === 'ENDED') loadLeaderboard()
  }, [contest?.status, loadLeaderboard])

  // Timer
  useEffect(() => {
    if (!contest?.startTime || contest.status !== 'ONGOING') { setTimeLeft(null); return }
    const end = new Date(contest.startTime).getTime() + contest.durationMin * 60 * 1000
    const tick = () => {
      const left = Math.max(0, end - Date.now())
      setTimeLeft(left)
      if (left === 0) load()
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [contest?.startTime, contest?.status, contest?.durationMin, load])

  async function handleJoin() {
    const res = await fetch(`/api/contests/${id}/join`, { method: 'POST' })
    if (res.ok) { toast.success('대회에 참가했습니다'); load() }
    else toast.error((await res.json()).error ?? '오류')
  }

  async function handleLeave() {
    await fetch(`/api/contests/${id}/join`, { method: 'DELETE' })
    load()
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) { toast.error('팀 이름을 입력해주세요'); return }
    setCreatingTeam(true)
    try {
      const res = await fetch(`/api/contests/${id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim(), description: teamDesc.trim() }),
      })
      if (res.ok) {
        toast.success('팀이 생성되었습니다')
        setShowTeamModal(false)
        setTeamName(''); setTeamDesc('')
        load()
      } else toast.error((await res.json()).error ?? '오류')
    } finally { setCreatingTeam(false) }
  }

  async function handleJoinTeam(teamId: string) {
    const res = await fetch(`/api/contests/${id}/teams/${teamId}/join`, { method: 'POST' })
    if (res.ok) { toast.success('팀에 참가했습니다'); load() }
    else toast.error((await res.json()).error ?? '오류')
  }

  async function handleLeaveTeam(teamId: string) {
    const res = await fetch(`/api/contests/${id}/teams/${teamId}/leave`, { method: 'POST' })
    if (res.ok) { toast.success('팀을 탈퇴했습니다'); load() }
    else toast.error((await res.json()).error ?? '오류')
  }

  async function handleDisbandTeam(teamId: string) {
    if (!confirm('팀을 해산하시겠습니까?')) return
    const res = await fetch(`/api/contests/${id}/teams/${teamId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('팀이 해산되었습니다'); load() }
    else toast.error((await res.json()).error ?? '오류')
  }

  async function handleStart() {
    const res = await fetch(`/api/contests/${id}/start`, { method: 'POST' })
    if (res.ok) { toast.success('대회가 시작되었습니다'); load() }
    else toast.error((await res.json()).error)
  }

  async function handleSubmit(problemId: string, isMultiPart: boolean) {
    if (isMultiPart) {
      const myParts = parts[problemId] ?? []
      if (myParts.some((p) => !p?.trim())) { toast.error('모든 칸을 입력해주세요'); return }
    } else {
      const answer = answers[problemId]?.trim()
      if (!answer) { toast.error('답을 입력해주세요'); return }
    }
    setSubmitting(problemId)
    try {
      const body = isMultiPart
        ? { problemId, parts: parts[problemId] ?? [] }
        : { problemId, answer: answers[problemId] }
      const res = await fetch(`/api/contests/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      if (data.correct) {
        toast.success(data.scoreBlocked ? '정답! (출제자는 점수 미반영)' : '정답입니다!')
        setContest((c) => c ? { ...c, mySubmissions: { ...c.mySubmissions, [problemId]: true } } : c)
      } else {
        toast.error('오답입니다. 다시 시도해보세요')
      }
    } finally { setSubmitting(null) }
  }

  async function handleEssaySubmit(problemId: string) {
    const content = essayInputs[problemId] ?? ''
    const images = essayImages[problemId] ?? []
    if (!content.trim() && images.length === 0) { toast.error('답안 내용 또는 이미지를 첨부하세요'); return }
    setSubmittingEssay(problemId)
    try {
      const res = await fetch(`/api/contests/${id}/essay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, content, imageUrls: images }),
      })
      if (res.ok) {
        toast.success('서술형 답안이 제출되었습니다')
        setEssayInputs((p) => ({ ...p, [problemId]: '' }))
        setEssayImages((p) => ({ ...p, [problemId]: [] }))
        setContest((c) => c ? { ...c, mySubmissions: { ...c.mySubmissions, [problemId]: false } } : c)
      } else { toast.error((await res.json()).error ?? '제출 실패') }
    } finally { setSubmittingEssay(null) }
  }

  async function handleEssayImageUpload(problemId: string, file: File) {
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) { toast.error('업로드 실패'); return }
    const { url } = await res.json()
    setEssayImages((p) => ({ ...p, [problemId]: [...(p[problemId] ?? []), url] }))
  }

  async function loadEssayReviews() {
    setEssayReviewLoading(true)
    try {
      const res = await fetch(`/api/contests/${id}/essay`)
      if (res.ok) { const d = await res.json(); setEssayReviews(d.submissions) }
    } finally { setEssayReviewLoading(false) }
  }

  async function handleEssayReview(submissionId: string, status: 'APPROVED' | 'REJECTED') {
    const res = await fetch(`/api/contests/${id}/essay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, status }),
    })
    if (res.ok) { toast.success(status === 'APPROVED' ? '승인되었습니다' : '반려되었습니다'); await loadEssayReviews() }
    else toast.error('처리 실패')
  }

  async function handleReorder(orderedIds: string[]) {
    const res = await fetch(`/api/contests/${id}/problems`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
    if (res.ok) { load() }
    else toast.error('순서 변경 실패')
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="h-64 bg-surface border border-border rounded-xl animate-pulse" /></div>
  if (!contest) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-text-secondary">대회를 찾을 수 없습니다</div>

  const isOrganizer = session?.user?.id === contest.organizerId
  const isAdmin = session?.user?.role === 'ADMIN'
  const isContributor = session?.user
    ? contest.contributors.some((c) => c.user.id === session.user!.id)
    : false
  const isParticipant = !!contest.myParticipant
  const canStart = (isOrganizer || isAdmin) && contest.status === 'APPROVED'
  const canEditProblems = (isOrganizer || isAdmin || isContributor) && !['ONGOING', 'ENDED'].includes(contest.status)
  const canChat = isOrganizer || isAdmin || isContributor
  const myTeamForChat = contest.teamContest
    ? teams.find((t) => t.members.some((m) => m.userId === session?.user?.id) || t.leaderId === session?.user?.id)
    : undefined
  const canTeamChat = contest.teamContest && !!myTeamForChat && !!session?.user

  async function saveInfo() {
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/contests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: infoDraft.title,
          description: infoDraft.description,
          rules: infoDraft.rules,
          durationMin: infoDraft.durationMin,
          prize1: infoDraft.prize1 !== '' ? Number(infoDraft.prize1) : null,
          prize2: infoDraft.prize2 !== '' ? Number(infoDraft.prize2) : null,
          prize3: infoDraft.prize3 !== '' ? Number(infoDraft.prize3) : null,
          contributors: infoDraft.contribs,
          bannerUrl: infoDraft.bannerUrl,
        }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      const updated = await res.json()
      // 응답에 contributors 포함되어 있으므로 즉시 state 반영 (버튼 사라짐 방지)
      if (updated && updated.contributors) setContest((c) => c ? { ...c, ...updated } : c)
      toast.success('대회 정보가 수정되었습니다')
      setEditingInfo(false)
      load()
    } finally { setSavingInfo(false) }
  }

  async function addProblem() {
    if (!newProblem.title.trim() || !newProblem.content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요'); return
    }
    if (!newProblem.isEssay) {
      if (newProblem.multiPartMode) {
        if (newProblem.subAnswers.length === 0 || newProblem.subAnswers.some((s) => !s.answer.trim())) {
          toast.error('모든 답변 슬롯에 정답을 입력해주세요'); return
        }
      } else if (!newProblem.answer.trim()) {
        toast.error('정답을 입력해주세요'); return
      }
    }
    setSavingNewProblem(true)
    try {
      const body = {
        ...newProblem,
        answer: newProblem.isEssay ? '[essay]' : (newProblem.multiPartMode ? '[multi-part]' : newProblem.answer),
        subAnswers: newProblem.multiPartMode && !newProblem.isEssay ? newProblem.subAnswers : [],
        isEssay: newProblem.isEssay,
      }
      const res = await fetch(`/api/contests/${id}/problems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      toast.success('문제가 추가되었습니다')
      setNewProblem({ title: '', content: '', answer: '', extraAnswers: [], subAnswers: [{ label: '(1)', answer: '', extra: [] }], multiPartMode: false, isEssay: false, points: 100, allowRetry: true })
      setAddingProblem(false)
      load()
    } finally { setSavingNewProblem(false) }
  }

  async function deleteProblem(problemId: string) {
    if (!confirm('문제를 삭제하시겠습니까?')) return
    setDeletingProblem(problemId)
    try {
      const res = await fetch(`/api/contests/${id}/problems/${problemId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      toast.success('문제가 삭제되었습니다')
      load()
    } finally { setDeletingProblem(null) }
  }

  async function saveProblemEdit(problemId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contests/${id}/problems/${problemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? '오류'); return }
      toast.success('문제가 수정되었습니다')
      setEditingProblem(null)
      load()
    } finally { setSaving(false) }
  }

  async function loadChat() {
    const res = await fetch(`/api/contests/${id}/chat`)
    if (res.ok) setChats(await res.json())
  }

  async function sendChat() {
    if (!chatMsg.trim()) return
    setChatLoading(true)
    try {
      const res = await fetch(`/api/contests/${id}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatMsg.trim() }),
      })
      if (res.ok) { setChatMsg(''); loadChat() }
      else toast.error((await res.json()).error ?? '오류')
    } finally { setChatLoading(false) }
  }

  async function loadTeamChat(teamId: string) {
    const res = await fetch(`/api/contests/${id}/teams/${teamId}/chat`)
    if (res.ok) setTeamChats(await res.json())
  }

  async function sendTeamChat(teamId: string) {
    if (!teamChatMsg.trim()) return
    setTeamChatLoading(true)
    try {
      const res = await fetch(`/api/contests/${id}/teams/${teamId}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: teamChatMsg.trim() }),
      })
      if (res.ok) { setTeamChatMsg(''); loadTeamChat(teamId) }
      else toast.error((await res.json()).error ?? '오류')
    } finally { setTeamChatLoading(false) }
  }

  function insertEditImageAtCursor(url: string) {
    const insert = `![이미지](${url})`
    const ta = editTextareaRef.current
    const start = ta?.selectionStart ?? null
    const end = ta?.selectionEnd ?? null
    setEditDraft((d) => {
      const content = d.content ?? ''
      const s = start ?? content.length
      const e = end ?? content.length
      return { ...d, content: content.slice(0, s) + insert + content.slice(e), imageUrls: [...(d.imageUrls ?? []), url] }
    })
    if (ta && start !== null) {
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length
        ta.focus()
      })
    }
  }

  async function uploadProblemImage(problemId: string, file: File) {
    setUploadingProblem(problemId)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('업로드 실패'); return }
      const { url } = await res.json()
      const problem = contest?.problems.find((p) => p.id === problemId)
      const currentUrls = problem?.imageUrls ?? []
      const patchRes = await fetch(`/api/contests/${id}/problems/${problemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: [...currentUrls, url] }),
      })
      if (patchRes.ok) { toast.success('이미지 업로드 완료'); load() }
    } finally { setUploadingProblem(null) }
  }

  const formatTime = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }

  const STATUS_COLORS: Record<string, string> = {
    APPROVED: 'text-green-700 bg-green-50 border-green-200',
    ONGOING:  'text-blue-700 bg-blue-50 border-blue-200',
    ENDED:    'text-gray-500 bg-gray-100 border-gray-200',
    PENDING:  'text-amber-700 bg-amber-50 border-amber-200',
    DRAFT:    'text-gray-400 bg-gray-50 border-gray-200',
  }
  const STATUS_TEXT: Record<string, string> = { APPROVED: '참가 신청', ONGOING: '진행 중', ENDED: '종료', PENDING: '검토 중', DRAFT: '초안' }

  // Banner upload handlers (for edit mode)
  function onBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => setBannerCropSrc(ev.target!.result as string)
    reader.readAsDataURL(file)
  }
  async function onBannerCrop(dataUrl: string) {
    setBannerCropSrc(null); setUploadingBanner(true)
    try {
      const res = await fetch(dataUrl); const blob = await res.blob()
      const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' })
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) { toast.error('배너 업로드 실패'); return }
      const { url } = await up.json()
      setInfoDraft((d) => ({ ...d, bannerUrl: url }))
      toast.success('배너가 설정되었습니다')
    } finally { setUploadingBanner(false) }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Banner cropper modal */}
      {bannerCropSrc && (
        <ImageCropper
          imageSrc={bannerCropSrc}
          defaultAspect={16 / 9}
          outputWidth={1200}
          title="대회 배너 영역 선택"
          onCrop={onBannerCrop}
          onCancel={() => setBannerCropSrc(null)}
        />
      )}

      {/* Header */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Banner (view mode) */}
        {!editingInfo && contest.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contest.bannerUrl} alt="대회 배너" className="w-full h-36 object-cover" />
        )}

        <div className="p-4 space-y-3">
        {editingInfo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-text-primary">대회 정보 수정</span>
              <button onClick={() => setEditingInfo(false)} className="text-muted hover:text-text-secondary"><X size={16} /></button>
            </div>

            {/* Banner upload (edit mode) */}
            <div>
              <label className="text-xs text-muted mb-1.5 block">대회 배너</label>
              {infoDraft.bannerUrl ? (
                <div className="relative group rounded-xl overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={infoDraft.bannerUrl} alt="배너" className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={() => bannerFileRef.current?.click()}
                      className="px-3 py-1.5 bg-white/90 text-gray-800 text-xs rounded-lg font-medium hover:bg-white transition-colors">변경</button>
                    <button type="button" onClick={() => setInfoDraft((d) => ({ ...d, bannerUrl: null }))}
                      className="px-3 py-1.5 bg-red-500/90 text-white text-xs rounded-lg font-medium hover:bg-red-500 transition-colors">삭제</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => bannerFileRef.current?.click()} disabled={uploadingBanner}
                  className="w-full h-20 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1 text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50">
                  <ImageIcon size={18} />
                  <span className="text-xs">{uploadingBanner ? '업로드 중...' : '배너 이미지 업로드'}</span>
                </button>
              )}
              <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={onBannerFileChange} />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">대회명</label>
              <input value={infoDraft.title} onChange={(e) => setInfoDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">설명</label>
              <textarea value={infoDraft.description} onChange={(e) => setInfoDraft((d) => ({ ...d, description: e.target.value }))} rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">규칙</label>
              <textarea value={infoDraft.rules} onChange={(e) => setInfoDraft((d) => ({ ...d, rules: e.target.value }))} rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">대회 시간 (분)</label>
              <input
                type="number" min={1} max={1440}
                value={infoDraft.durationMin}
                onChange={(e) => setInfoDraft((d) => ({ ...d, durationMin: parseInt(e.target.value) || 120 }))}
                className="w-32 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-2 block">우승 상금 (포인트)</label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { rank: '🥇 1등', key: 'prize1' as const },
                  { rank: '🥈 2등', key: 'prize2' as const },
                  { rank: '🥉 3등', key: 'prize3' as const },
                ].map(({ rank, key }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="text-xs text-text-secondary w-14">{rank}</span>
                    <input
                      type="number" min={0}
                      value={infoDraft[key]}
                      onChange={(e) => setInfoDraft((d) => ({ ...d, [key]: e.target.value }))}
                      placeholder="미지급"
                      className="w-28 bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                    <span className="text-xs text-muted">pt</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted mb-2 block">출제자 / 검토자</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {infoDraft.contribs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-xs text-text-secondary">
                    <span className="text-accent font-medium">{c.role === 'CONTRIBUTOR' ? '출제' : '검토'}</span>
                    {c.query}
                    <button onClick={() => setInfoDraft((d) => ({ ...d, contribs: d.contribs.filter((_, k) => k !== i) }))} className="text-muted hover:text-red-400"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newContribQuery}
                  onChange={(e) => setNewContribQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newContribQuery.trim()) {
                      setInfoDraft((d) => ({ ...d, contribs: [...d.contribs, { userId: '', query: newContribQuery.trim(), role: newContribRole }] }))
                      setNewContribQuery('')
                    }
                  }}
                  placeholder="이메일 또는 닉네임"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <select value={newContribRole} onChange={(e) => setNewContribRole(e.target.value as 'CONTRIBUTOR' | 'REVIEWER')}
                  className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="CONTRIBUTOR">출제자</option>
                  <option value="REVIEWER">검토자</option>
                </select>
                <button type="button" onClick={() => {
                  if (!newContribQuery.trim()) return
                  setInfoDraft((d) => ({ ...d, contribs: [...d.contribs, { userId: '', query: newContribQuery.trim(), role: newContribRole }] }))
                  setNewContribQuery('')
                }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors">
                  <UserPlus size={12} /> 추가
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => setEditingInfo(false)} className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-surface-2 transition-colors">취소</button>
              <button onClick={saveInfo} disabled={savingInfo}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                <Save size={13} />{savingInfo ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[contest.status] ?? ''}`}>
                    {STATUS_TEXT[contest.status]}
                  </span>
                  {contest.status === 'ONGOING' && timeLeft !== null && (
                    <span className={`text-sm font-mono font-bold ${timeLeft < 300000 ? 'text-red-500' : 'text-accent'}`}>
                      <Clock size={13} className="inline mr-1" />{formatTime(timeLeft)}
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-text-primary">{contest.title}</h1>
                {contest.description && <p className="text-sm text-text-secondary mt-1">{contest.description}</p>}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted flex items-center gap-1"><Clock size={13} />{contest.durationMin}분</div>
                  <div className="text-sm text-muted flex items-center gap-1"><Users size={13} />{contest._count.participants}명</div>
                </div>
                {(isOrganizer || isAdmin) && !['ONGOING', 'ENDED'].includes(contest.status) && (
                  <button
                    onClick={() => {
                      setInfoDraft({
                        title: contest.title,
                        description: contest.description ?? '',
                        rules: contest.rules ?? '',
                        durationMin: contest.durationMin,
                        prize1: contest.prize1 != null ? String(contest.prize1) : '',
                        prize2: contest.prize2 != null ? String(contest.prize2) : '',
                        prize3: contest.prize3 != null ? String(contest.prize3) : '',
                        contribs: contest.contributors.map((c) => ({ userId: c.userId, query: c.user.name ?? c.userId, role: c.role as 'CONTRIBUTOR' | 'REVIEWER' })),
                        bannerUrl: contest.bannerUrl ?? null,
                      })
                      setEditingInfo(true)
                    }}
                    className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
                  >
                    <Pencil size={12} /> 수정
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <Avatar name={contest.organizer.name} image={contest.organizer.image} size={20} />
                <span className="font-medium text-text-secondary">{contest.organizer.name}</span>
                <TierBadge points={contest.organizer.points} />
                <span className="text-muted">(주최)</span>
              </div>
              {['CONTRIBUTOR', 'REVIEWER'].map((role) => {
                const group = contest.contributors.filter((c) => c.role === role)
                if (!group.length) return null
                return (
                  <div key={role} className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-text-secondary">{role === 'CONTRIBUTOR' ? '출제' : '검토'}:</span>
                    {group.map((c) => (
                      <Link key={c.id} href={`/users/${c.userId}`} className="flex items-center gap-1 px-1.5 py-0.5 bg-surface-2 rounded hover:bg-surface transition-colors">
                        <Avatar name={c.user.name} image={c.user.image} size={16} />
                        <span className="text-text-secondary text-xs">{c.user.name ?? '?'}</span>
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button onClick={handleStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              <Play size={14} /> 대회 시작
            </button>
          )}
          {['APPROVED', 'ONGOING'].includes(contest.status) && session?.user && !isOrganizer && (
            contest.teamContest ? (() => {
              const myTeam = teams.find((t) => t.members.some((m) => m.userId === session.user!.id))
              return myTeam ? (
                <button onClick={() => handleLeaveTeam(myTeam.id)}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
                  팀 탈퇴
                </button>
              ) : (
                <button onClick={() => setShowTeamModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
                  팀 만들기
                </button>
              )
            })() : (
              isParticipant ? (
                <button onClick={handleLeave}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors">
                  참가 취소
                </button>
              ) : (
                <button onClick={handleJoin}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
                  참가하기
                </button>
              )
            )
          )}
        </div>
        </div>{/* /p-4 */}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-0.5 bg-surface rounded-lg border border-border w-fit flex-wrap">
        {(['problems', 'leaderboard', 'info'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === 'leaderboard') { loadLeaderboard(); if (contest.teamContest) loadTeams() } }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            {t === 'problems' ? '문제' : t === 'leaderboard' ? '순위표' : '정보'}
          </button>
        ))}
        {(canChat || canTeamChat) && (
          <button onClick={() => {
            setTab('chat')
            if (canChat) loadChat()
            if (canTeamChat && myTeamForChat) { setChatSubTab('team'); loadTeamChat(myTeamForChat.id) }
            else setChatSubTab('global')
          }}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === 'chat' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            <MessageSquare size={13} /> 채팅
          </button>
        )}
        {(isOrganizer || isAdmin || isContributor) && (
          <button onClick={() => { setTab('essay'); loadEssayReviews() }}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === 'essay' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            <FileText size={13} /> 서술형 검토
          </button>
        )}
      </div>

      {/* Problems */}
      {tab === 'problems' && (
        <div className="space-y-3">
          {contest.status === 'APPROVED' && !isParticipant && !isOrganizer && !isContributor && (
            <div className="p-4 bg-surface border border-border rounded-xl text-sm text-text-secondary text-center">
              대회 시작 후 참가자에게 문제가 공개됩니다
            </div>
          )}
          {(contest.status === 'ONGOING' || contest.status === 'ENDED' || isOrganizer || isAdmin || isContributor) && contest.problems.map((problem) => {
            const solved = contest.mySubmissions?.[problem.id]
            const isEditing = editingProblem === problem.id
            const isDragOver = dragOverPid === problem.id
            return (
              <div
                key={problem.id}
                className={`bg-surface border rounded-xl p-4 space-y-3 transition-all ${solved ? 'border-green-300' : 'border-border'} ${isDragOver ? 'ring-2 ring-accent/40 border-accent/40' : ''}`}
                draggable={canEditProblems}
                onDragStart={() => { dragPidRef.current = problem.id }}
                onDragOver={(e) => { if (!canEditProblems) return; e.preventDefault(); setDragOverPid(problem.id) }}
                onDragLeave={() => setDragOverPid(null)}
                onDrop={() => {
                  setDragOverPid(null)
                  const from = dragPidRef.current
                  if (!from || from === problem.id) return
                  const ids = contest.problems.map((p) => p.id)
                  const fromIdx = ids.indexOf(from)
                  const toIdx = ids.indexOf(problem.id)
                  if (fromIdx === -1 || toIdx === -1) return
                  const newIds = [...ids]
                  newIds.splice(fromIdx, 1)
                  newIds.splice(toIdx, 0, from)
                  handleReorder(newIds)
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {canEditProblems && <GripVertical size={14} className="text-muted cursor-grab shrink-0" />}
                    <span className="text-lg font-bold text-accent w-8">{problem.label}</span>
                    <div>
                      <h3 className="font-semibold text-text-primary">{problem.title}</h3>
                      <span className="text-xs text-muted">{problem.points}점</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {solved && <CheckCircle size={20} className="text-green-500 shrink-0" />}
                    {canEditProblems && !isEditing && (
                      <button onClick={() => { setEditingProblem(problem.id); setEditDraft({ title: problem.title, content: problem.content, answer: problem.answer ?? '', extraAnswers: problem.extraAnswers ?? [], subAnswers: problem.subAnswers ?? [], points: problem.points, label: problem.label, imageUrls: problem.imageUrls ?? [], allowRetry: problem.allowRetry !== false }) }}
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-text-secondary transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                    {(isOrganizer || isAdmin) && !isEditing && !['ONGOING', 'ENDED'].includes(contest.status) && (
                      <button onClick={() => deleteProblem(problem.id)} disabled={deletingProblem === problem.id}
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-red-400 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    )}
                    {isEditing && (
                      <button onClick={() => setEditingProblem(null)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="flex gap-2">
                      <div className="w-16">
                        <label className="text-xs text-muted mb-1 block">레이블</label>
                        <input value={editDraft.label ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted mb-1 block">제목</label>
                        <input value={editDraft.title ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                      </div>
                      <div className="w-20">
                        <label className="text-xs text-muted mb-1 block">점수</label>
                        <input type="number" value={editDraft.points ?? 100} onChange={(e) => setEditDraft((d) => ({ ...d, points: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted block">내용 (마크다운)</label>
                        <button type="button" onClick={() => setEditPreview((v) => !v)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${editPreview ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text-secondary'}`}>
                          {editPreview ? <><PenLine size={11} /> 편집</> : <><Eye size={11} /> 미리보기</>}
                        </button>
                      </div>
                      {editPreview ? (
                        <div className="w-full min-h-[144px] bg-background border border-border rounded-lg px-3 py-2 text-sm prose-content">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {editDraft.content || '*내용 없음*'}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <textarea
                          ref={editTextareaRef}
                          value={editDraft.content ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                          rows={6} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y font-mono" />
                      )}
                    </div>
                    <div className="space-y-2">
                      {/* 정답 모드 선택 */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted block">답변 유형</label>
                        <div className="flex gap-1.5 flex-wrap">
                          <button type="button"
                            onClick={() => setEditDraft((d) => ({ ...d, subAnswers: [], answer: d.answer === '[multi-part]' || d.answer === '[essay]' ? '' : d.answer, isEssay: false }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${(editDraft.subAnswers?.length ?? 0) === 0 && !editDraft.isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'}`}>
                            단일 답변
                          </button>
                          <button type="button"
                            onClick={() => setEditDraft((d) => ({ ...d, subAnswers: (d.subAnswers?.length ?? 0) > 0 ? d.subAnswers : [{ label: '(1)', answer: '', extra: [] }], answer: '[multi-part]', isEssay: false }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${(editDraft.subAnswers?.length ?? 0) > 0 && !editDraft.isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'}`}>
                            다중 필수 답변
                          </button>
                          <button type="button"
                            onClick={() => setEditDraft((d) => ({ ...d, isEssay: true, subAnswers: [], answer: '[essay]' }))}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${editDraft.isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'}`}>
                            <FileText size={11} /> 서술형
                          </button>
                        </div>
                      </div>
                      {editDraft.isEssay ? (
                        <div className="p-3 bg-surface-2 border border-border rounded-xl text-xs text-text-secondary">
                          서술형 문제입니다. 참가자가 글·이미지로 답안을 제출하면 검토자가 승인/반려합니다.
                        </div>
                      ) : (editDraft.subAnswers?.length ?? 0) === 0 ? (
                        <div className="space-y-2">
                          <input value={editDraft.answer ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, answer: e.target.value }))}
                            placeholder="정답 (대소문자·공백 무시)"
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                          {(editDraft.extraAnswers ?? []).map((ea, ei) => (
                            <div key={ei} className="flex gap-2">
                              <input value={ea}
                                onChange={(e) => { const next = [...(editDraft.extraAnswers ?? [])]; next[ei] = e.target.value; setEditDraft((d) => ({ ...d, extraAnswers: next })) }}
                                placeholder={`허용 정답 ${ei + 2}`}
                                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                              <button type="button" onClick={() => setEditDraft((d) => ({ ...d, extraAnswers: (d.extraAnswers ?? []).filter((_, k) => k !== ei) }))} className="text-muted hover:text-red-400"><X size={12} /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setEditDraft((d) => ({ ...d, extraAnswers: [...(d.extraAnswers ?? []), ''] }))} className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
                            <Plus size={11} /> 허용 정답 추가
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                          <p className="text-xs text-muted">모든 슬롯을 정확히 입력해야 정답 처리됩니다</p>
                          {(editDraft.subAnswers ?? []).map((sub, si) => (
                            <div key={si} className="flex gap-2 items-center">
                              <input value={sub.label}
                                onChange={(e) => { const next = (editDraft.subAnswers ?? []).map((s, k) => k === si ? { ...s, label: e.target.value } : s); setEditDraft((d) => ({ ...d, subAnswers: next })) }}
                                placeholder="레이블"
                                className="w-16 bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" />
                              <input value={sub.answer}
                                onChange={(e) => { const next = (editDraft.subAnswers ?? []).map((s, k) => k === si ? { ...s, answer: e.target.value } : s); setEditDraft((d) => ({ ...d, subAnswers: next })) }}
                                placeholder="정답"
                                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                              {(editDraft.subAnswers ?? []).length > 1 && (
                                <button type="button" onClick={() => setEditDraft((d) => ({ ...d, subAnswers: (d.subAnswers ?? []).filter((_, k) => k !== si) }))} className="text-muted hover:text-red-400"><X size={12} /></button>
                              )}
                            </div>
                          ))}
                          <button type="button"
                            onClick={() => setEditDraft((d) => ({ ...d, subAnswers: [...(d.subAnswers ?? []), { label: `(${(d.subAnswers ?? []).length + 1})`, answer: '', extra: [] }] }))}
                            className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
                            <Plus size={11} /> 슬롯 추가
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">이미지</label>
                      <div className="flex gap-2 flex-wrap items-center">
                        {(editDraft.imageUrls ?? []).map((url, ui) => (
                          <div key={url} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-border" />
                            <button type="button" onClick={() => setEditDraft((d) => ({
                              ...d,
                              imageUrls: (d.imageUrls ?? []).filter((_, k) => k !== ui),
                              content: (d.content ?? '').replace(`![이미지](${url})`, ''),
                            }))}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => editFileInputRef.current?.click()} disabled={uploadingProblem === problem.id}
                          className="w-14 h-14 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50">
                          <ImagePlus size={13} /><span className="text-xs">{uploadingProblem === problem.id ? '...' : '추가'}</span>
                        </button>
                        <input ref={editFileInputRef} type="file" accept="image/*" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) {
                              const fd = new FormData(); fd.append('file', f)
                              fetch('/api/upload', { method: 'POST', body: fd })
                                .then((r) => r.json())
                                .then((d) => insertEditImageAtCursor(d.url))
                              e.target.value = ''
                            }
                          }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setEditDraft((d) => ({ ...d, allowRetry: !d.allowRetry }))}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${editDraft.allowRetry !== false ? 'text-green-600 bg-green-50 border border-green-200' : 'text-red-500 bg-red-50 border border-red-200'}`}>
                        {editDraft.allowRetry !== false ? <><RefreshCw size={10} /> 재시도 허용</> : <><Ban size={10} /> 재시도 불가</>}
                      </button>
                      <button onClick={() => saveProblemEdit(problem.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                        <Save size={13} /> {saving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-border pt-3 space-y-3">
                    {problem.allowRetry === false && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-500">
                        <Ban size={10} /> 재시도 불가
                      </span>
                    )}
                    <div className="prose-content">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                        {problem.content}
                      </ReactMarkdown>
                    </div>
                    {problem.imageUrls && problem.imageUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {problem.imageUrls.map((url: string) => (
                          <div key={url} className="relative group inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="max-h-24 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
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
                    {canEditProblems && (
                      <button onClick={() => fileInputRef.current && (fileInputRef.current.dataset.pid = problem.id) && fileInputRef.current.click()} disabled={uploadingProblem === problem.id}
                        className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors disabled:opacity-50">
                        <ImagePlus size={12} /> {uploadingProblem === problem.id ? '업로드 중...' : '이미지 추가'}
                      </button>
                    )}
                    {(isOrganizer || isAdmin || isContributor) && (
                      <div className="text-xs text-muted">
                        {problem.isEssay ? (
                          <span className="flex items-center gap-1 text-violet-500"><FileText size={11} /> 서술형 문제 — 서술형 검토 탭에서 답안 확인</span>
                        ) : problem.subAnswers && problem.subAnswers.length > 0 ? (
                          <div className="space-y-0.5">
                            <span className="font-medium">정답:</span>
                            {problem.subAnswers.map((sub, si) => (
                              <p key={si}><span className="font-medium">{sub.label}:</span> <span className="font-mono text-accent">{sub.answer}</span>{sub.extra && sub.extra.length > 0 && <span className="ml-1 text-muted">({sub.extra.join(', ')})</span>}</p>
                            ))}
                          </div>
                        ) : problem.answer && !['[multi-part]', '[essay]'].includes(problem.answer) ? (
                          <p>정답: <span className="font-mono text-accent">{problem.answer}</span>
                            {problem.extraAnswers && problem.extraAnswers.length > 0 && <span className="ml-1">, {problem.extraAnswers.join(', ')}</span>}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                {contest.status === 'ONGOING' && isParticipant && !solved && !isEditing && !problem.isEssay && (() => {
                  const subDefs = problem.subAnswers ?? []
                  const isMultiPart = subDefs.length > 0
                  return (
                    <div className="pt-2 border-t border-border space-y-2">
                      {isMultiPart ? (
                        <>
                          {subDefs.map((def, di) => (
                            <div key={di} className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-secondary w-10 shrink-0">{def.label}</span>
                              <input
                                value={(parts[problem.id] ?? [])[di] ?? ''}
                                onChange={(e) => {
                                  const next = [...(parts[problem.id] ?? Array(subDefs.length).fill(''))]
                                  next[di] = e.target.value
                                  setParts((p) => ({ ...p, [problem.id]: next }))
                                }}
                                placeholder={`${def.label} 답 입력`}
                                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                              />
                            </div>
                          ))}
                          <button
                            onClick={() => handleSubmit(problem.id, true)}
                            disabled={submitting === problem.id || (parts[problem.id] ?? []).length !== subDefs.length || (parts[problem.id] ?? []).some((p) => !p?.trim())}
                            className="w-full px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50"
                          >
                            {submitting === problem.id ? '...' : '모두 제출'}
                          </button>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={answers[problem.id] ?? ''}
                            onChange={(e) => setAnswers((a) => ({ ...a, [problem.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(problem.id, false)}
                            placeholder="정답 입력 후 Enter"
                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                          />
                          <button onClick={() => handleSubmit(problem.id, false)} disabled={submitting === problem.id}
                            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                            {submitting === problem.id ? '...' : '제출'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
                {/* 서술형 제출 UI */}
                {contest.status === 'ONGOING' && isParticipant && problem.isEssay && !isEditing && (() => {
                  const myEssay = essayInputs[problem.id] ?? ''
                  const myImgs = essayImages[problem.id] ?? []
                  const alreadySubmitted = contest.mySubmissions?.[problem.id] !== undefined
                  return (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-xs text-muted font-medium">서술형 답안 제출</p>
                      <textarea
                        value={myEssay}
                        onChange={(e) => setEssayInputs((p) => ({ ...p, [problem.id]: e.target.value }))}
                        placeholder="답안을 작성하세요 (글 + 이미지 모두 가능)"
                        rows={4}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y"
                      />
                      {myImgs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {myImgs.map((url, i) => (
                            <div key={url} className="relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                              <button type="button" onClick={() => setEssayImages((p) => ({ ...p, [problem.id]: p[problem.id].filter((_, k) => k !== i) }))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { essayUploadPidRef.current = problem.id; essayFileRef.current?.click() }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary transition-colors">
                          <ImagePlus size={12} /> 이미지 첨부
                        </button>
                        <button onClick={() => handleEssaySubmit(problem.id)} disabled={submittingEssay === problem.id}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                          <Send size={13} /> {submittingEssay === problem.id ? '제출 중...' : alreadySubmitted ? '재제출' : '제출'}
                        </button>
                      </div>
                      {alreadySubmitted && <p className="text-xs text-amber-500">제출됨 — 검토 대기 중</p>}
                    </div>
                  )
                })()}
                {solved && !problem.isEssay && <div className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={14} /> 정답!</div>}
              </div>
            )
          })}
          {contest.problems.length === 0 && !addingProblem && <div className="text-center py-8 text-text-secondary text-sm">문제가 없습니다</div>}

          {/* Add Problem form */}
          {addingProblem && (
            <div className="bg-surface border border-accent/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-accent">새 문제 추가</span>
                <button onClick={() => setAddingProblem(false)} className="text-muted hover:text-text-secondary"><X size={14} /></button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted mb-1 block">제목</label>
                  <input value={newProblem.title} onChange={(e) => setNewProblem((d) => ({ ...d, title: e.target.value }))}
                    placeholder="문제 제목"
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div className="w-20">
                  <label className="text-xs text-muted mb-1 block">점수</label>
                  <input type="number" value={newProblem.points} onChange={(e) => setNewProblem((d) => ({ ...d, points: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">내용 (마크다운)</label>
                <textarea value={newProblem.content} onChange={(e) => setNewProblem((d) => ({ ...d, content: e.target.value }))}
                  rows={5} placeholder="문제 내용..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-y font-mono" />
              </div>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted block">답변 유형</label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button type="button"
                      onClick={() => setNewProblem((d) => ({ ...d, multiPartMode: false, isEssay: false }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!newProblem.multiPartMode && !newProblem.isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'}`}>
                      단일 답변
                    </button>
                    <button type="button"
                      onClick={() => setNewProblem((d) => ({ ...d, multiPartMode: true, isEssay: false }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newProblem.multiPartMode && !newProblem.isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'}`}>
                      다중 필수 답변
                    </button>
                    <button type="button"
                      onClick={() => setNewProblem((d) => ({ ...d, isEssay: true, multiPartMode: false }))}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newProblem.isEssay ? 'bg-accent text-white border-accent' : 'text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'}`}>
                      <FileText size={11} /> 서술형
                    </button>
                  </div>
                </div>
                {newProblem.isEssay ? (
                  <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-600">
                    서술형 문제입니다. 참가자가 작성한 답안을 검토자가 직접 승인/반려합니다.
                  </div>
                ) : !newProblem.multiPartMode ? (
                  <div className="space-y-2">
                    <input value={newProblem.answer} onChange={(e) => setNewProblem((d) => ({ ...d, answer: e.target.value }))}
                      placeholder="정답 (대소문자·공백 무시)"
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                    {newProblem.extraAnswers.map((ea, ei) => (
                      <div key={ei} className="flex gap-2">
                        <input value={ea}
                          onChange={(e) => { const next = [...newProblem.extraAnswers]; next[ei] = e.target.value; setNewProblem((d) => ({ ...d, extraAnswers: next })) }}
                          placeholder={`허용 정답 ${ei + 2}`}
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                        <button type="button" onClick={() => setNewProblem((d) => ({ ...d, extraAnswers: d.extraAnswers.filter((_, k) => k !== ei) }))} className="text-muted hover:text-red-400"><X size={12} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setNewProblem((d) => ({ ...d, extraAnswers: [...d.extraAnswers, ''] }))} className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
                      <Plus size={11} /> 허용 정답 추가
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                    <p className="text-xs text-muted">모든 슬롯을 정확히 입력해야 정답 처리됩니다</p>
                    {newProblem.subAnswers.map((sub, si) => (
                      <div key={si} className="flex gap-2 items-center">
                        <input value={sub.label}
                          onChange={(e) => { const next = newProblem.subAnswers.map((s, k) => k === si ? { ...s, label: e.target.value } : s); setNewProblem((d) => ({ ...d, subAnswers: next })) }}
                          placeholder="레이블"
                          className="w-16 bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" />
                        <input value={sub.answer}
                          onChange={(e) => { const next = newProblem.subAnswers.map((s, k) => k === si ? { ...s, answer: e.target.value } : s); setNewProblem((d) => ({ ...d, subAnswers: next })) }}
                          placeholder="정답"
                          className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                        {newProblem.subAnswers.length > 1 && (
                          <button type="button" onClick={() => setNewProblem((d) => ({ ...d, subAnswers: d.subAnswers.filter((_, k) => k !== si) }))} className="text-muted hover:text-red-400"><X size={12} /></button>
                        )}
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setNewProblem((d) => ({ ...d, subAnswers: [...d.subAnswers, { label: `(${d.subAnswers.length + 1})`, answer: '', extra: [] }] }))}
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
                      <Plus size={11} /> 슬롯 추가
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setNewProblem((d) => ({ ...d, allowRetry: !d.allowRetry }))}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${newProblem.allowRetry ? 'text-green-600 bg-green-50 border border-green-200' : 'text-red-500 bg-red-50 border border-red-200'}`}>
                    {newProblem.allowRetry ? <><RefreshCw size={10} /> 재시도 허용</> : <><Ban size={10} /> 재시도 불가</>}
                  </button>
                </div>
                <button onClick={addProblem} disabled={savingNewProblem}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                  <Plus size={13} /> {savingNewProblem ? '추가 중...' : '문제 추가'}
                </button>
              </div>
            </div>
          )}

          {/* Add problem button */}
          {canEditProblems && !addingProblem && (
            <button onClick={() => setAddingProblem(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-accent hover:text-accent text-text-secondary text-sm transition-colors">
              <Plus size={14} /> 문제 추가
            </button>
          )}

          {/* hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              const pid = fileInputRef.current?.dataset.pid
              if (f && pid) uploadProblemImage(pid, f)
              if (e.target) e.target.value = ''
            }} />
          <input ref={essayFileRef} type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f && essayUploadPidRef.current) await handleEssayImageUpload(essayUploadPidRef.current, f)
              if (e.target) e.target.value = ''
            }} />
        </div>
      )}

      {/* Essay review tab */}
      {tab === 'essay' && (isOrganizer || isAdmin || isContributor) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">서술형 답안 검토</h3>
            <button onClick={loadEssayReviews} disabled={essayReviewLoading}
              className="text-xs text-accent hover:underline disabled:opacity-50">새로고침</button>
          </div>
          {/* Problem filter */}
          {contest.problems.filter(p => p.isEssay).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted">문제별 필터:</span>
              <button
                onClick={() => setEssayFilterProblem('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${essayFilterProblem === 'all' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:border-accent/40'}`}
              >전체</button>
              {contest.problems.filter(p => p.isEssay).map(p => (
                <button
                  key={p.id}
                  onClick={() => setEssayFilterProblem(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${essayFilterProblem === p.id ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:border-accent/40'}`}
                >{p.label}: {p.title}</button>
              ))}
            </div>
          )}
          {essayReviewLoading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-surface border border-border rounded-xl animate-pulse" />)}</div>
          ) : essayReviews.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">제출된 서술형 답안이 없습니다</div>
          ) : (
            <div className="space-y-4">
              {(essayFilterProblem === 'all' ? essayReviews : essayReviews.filter(s => s.problem.id === essayFilterProblem)).map((sub) => {
                const images: string[] = (() => { try { return JSON.parse(sub.imageUrls) } catch { return [] } })()
                return (
                  <div key={sub.id} className={`bg-surface border rounded-xl p-4 space-y-3 ${sub.status === 'APPROVED' ? 'border-green-300' : sub.status === 'REJECTED' ? 'border-red-300' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={sub.user.name} image={sub.user.image} size={28} />
                        <div>
                          <span className="text-sm font-medium text-text-primary">{sub.user.name}</span>
                          <TierBadge points={sub.user.points} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted">{sub.problem.label}: {sub.problem.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${sub.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : sub.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {sub.status === 'APPROVED' ? '승인' : sub.status === 'REJECTED' ? '반려' : '검토 중'}
                        </span>
                      </div>
                    </div>
                    {sub.content && <p className="text-sm text-text-primary whitespace-pre-wrap bg-surface-2 rounded-lg p-3">{sub.content}</p>}
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {images.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={url} src={url} alt="" className="max-h-40 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <button onClick={() => handleEssayReview(sub.id, 'APPROVED')} disabled={sub.status === 'APPROVED'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors disabled:opacity-40">
                        <CheckCheck size={12} /> 승인 (+{sub.problem.id ? contest.problems.find(p=>p.id===sub.problem.id)?.points ?? 0 : 0}점)
                      </button>
                      <button onClick={() => handleEssayReview(sub.id, 'REJECTED')} disabled={sub.status === 'REJECTED'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-40">
                        <XCircle size={12} /> 반려
                      </button>
                      <span className="text-xs text-muted ml-auto">{timeAgo(sub.createdAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        contest.teamContest ? (
          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-sm bg-surface border border-border rounded-2xl">아직 팀이 없습니다</div>
            ) : (
              (leaderboard as unknown as { rank: number; teamId: string; teamName: string; score: number; memberCount: number; teamSize: number; isFull: boolean; members: { id: string; name?: string | null; image?: string | null; points: number }[]; solvedProblems: { problem: { label: string } }[] }[]).map((entry) => {
                const myTeam = teams.find((t) => t.id === entry.teamId)
                const isMine = myTeam?.members.some((m) => m.userId === session?.user?.id)
                return (
                  <div key={entry.teamId} className={`bg-surface border rounded-xl p-3 space-y-2 ${isMine ? 'border-accent/40' : 'border-border'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 inline-flex items-center justify-center rounded-lg text-sm font-bold border ${
                          entry.rank === 1 ? 'text-yellow-700 bg-yellow-50 border-yellow-300' :
                          entry.rank === 2 ? 'text-gray-600 bg-gray-100 border-gray-300' :
                          entry.rank === 3 ? 'text-orange-700 bg-orange-50 border-orange-300' :
                          'text-muted border-transparent'}`}>{entry.rank}</span>
                        <div>
                          <span className="font-semibold text-text-primary">{entry.teamName}</span>
                          {isMine && <span className="ml-2 text-xs text-accent">(내 팀)</span>}
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex items-center">
                              {entry.members.slice(0, 5).map((m, mi) => (
                                <div key={m.id} style={{ marginLeft: mi > 0 ? '-8px' : '0', zIndex: 5 - mi }} className="relative">
                                  <Avatar name={m.name} image={m.image} size={20} className="ring-2 ring-surface" />
                                </div>
                              ))}
                            </div>
                            <span className="text-xs text-muted ml-2">{entry.memberCount}/{entry.teamSize}명</span>
                            {entry.isFull && <span className="text-xs text-green-600 font-medium">완성</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1 flex-wrap">
                          {entry.solvedProblems.map((s) => (
                            <span key={s.problem.label} className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded font-medium">
                              {s.problem.label}
                            </span>
                          ))}
                        </div>
                        <span className="font-bold text-accent">{entry.score}점</span>
                        {!isMine && !entry.isFull && session?.user && ['APPROVED', 'ONGOING'].includes(contest.status) && !teams.some((t) => t.members.some((m) => m.userId === session.user!.id)) && (
                          <button onClick={() => handleJoinTeam(entry.teamId)}
                            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-dim transition-colors">
                            참가
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">아직 참가자가 없습니다</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">순위</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">참가자</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">해결</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">점수</th>
                </tr></thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.user.id} className={`border-b border-border last:border-0 hover:bg-surface-2 transition-colors ${session?.user?.id === entry.user.id ? 'bg-accent/5' : ''}`}>
                      <td className="px-3 py-2">
                        <span className={`w-6 h-6 inline-flex items-center justify-center rounded text-xs font-bold border ${
                          entry.rank === 1 ? 'text-yellow-700 bg-yellow-50 border-yellow-300' :
                          entry.rank === 2 ? 'text-gray-600 bg-gray-100 border-gray-300' :
                          entry.rank === 3 ? 'text-orange-700 bg-orange-50 border-orange-300' :
                          'text-muted border-transparent'}`}>{entry.rank}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={entry.user.name} image={entry.user.image} size={22} />
                          <span className="font-medium text-text-primary text-sm">{entry.user.name ?? '?'}</span>
                          {session?.user?.id === entry.user.id && <span className="text-xs text-accent">(나)</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {entry.solvedProblems.map((s) => (
                            <span key={s.problem.label} className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded font-medium">
                              {s.problem.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-accent text-sm">{entry.score}점</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {/* Chat */}
      {tab === 'chat' && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '360px' }}>
          {/* Sub-tabs */}
          {canChat && canTeamChat ? (
            <div className="flex border-b border-border">
              <button
                onClick={() => { setChatSubTab('global'); loadChat() }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${chatSubTab === 'global' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
              >전체 채팅</button>
              <button
                onClick={() => { setChatSubTab('team'); if (myTeamForChat) loadTeamChat(myTeamForChat.id) }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${chatSubTab === 'team' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
              >팀 채팅 · {myTeamForChat?.name}</button>
            </div>
          ) : (
            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-text-primary flex items-center gap-2">
              <MessageSquare size={14} className="text-accent" />
              {canTeamChat ? `팀 채팅 · ${myTeamForChat?.name}` : '전체 채팅'}
            </div>
          )}

          {/* Messages */}
          {(() => {
            const activeChats = (canTeamChat && chatSubTab === 'team') ? teamChats : chats
            return (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
                  {activeChats.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary text-sm">아직 메시지가 없습니다</div>
                  ) : (
                    activeChats.map((c) => (
                      <div key={c.id} className={`flex gap-2 ${c.author.id === session?.user?.id ? 'flex-row-reverse' : ''}`}>
                        <Avatar name={c.author.name} image={c.author.image} size={28} />
                        <div className={`max-w-xs ${c.author.id === session?.user?.id ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                          {c.author.id !== session?.user?.id && (
                            <span className="text-xs text-muted px-1">{c.author.name}</span>
                          )}
                          <div className={`px-3 py-2 rounded-2xl text-sm ${c.author.id === session?.user?.id ? 'bg-accent text-white rounded-tr-sm' : 'bg-surface-2 text-text-primary rounded-tl-sm'}`}>
                            {c.content}
                          </div>
                          <span className="text-xs text-muted px-1">{timeAgo(c.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-3 border-t border-border flex gap-2">
                  {canTeamChat && chatSubTab === 'team' ? (
                    <>
                      <input
                        value={teamChatMsg}
                        onChange={(e) => setTeamChatMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && myTeamForChat && sendTeamChat(myTeamForChat.id)}
                        placeholder="팀원에게 메시지..."
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                      />
                      <button onClick={() => myTeamForChat && sendTeamChat(myTeamForChat.id)} disabled={teamChatLoading || !teamChatMsg.trim()}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                        <Send size={13} /> 전송
                      </button>
                    </>
                  ) : canChat ? (
                    <>
                      <input
                        value={chatMsg}
                        onChange={(e) => setChatMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                        placeholder="메시지 입력..."
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                      />
                      <button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                        <Send size={13} /> 전송
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Team list for team contests (shown in problems tab) */}
      {tab === 'problems' && contest.teamContest && teams.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">팀 목록 ({teams.length}개)</h3>
          <div className="space-y-2">
            {teams.map((team) => {
              const isMine = team.members.some((m) => m.userId === session?.user?.id)
              const isFull = team.members.length >= (contest.teamSize ?? 1)
              const isMyLeader = team.leaderId === session?.user?.id
              return (
                <div key={team.id} className={`flex items-center justify-between p-3 rounded-xl border ${isMine ? 'border-accent/40 bg-accent/5' : 'border-border'}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {team.members.slice(0, 5).map((m, mi) => (
                        <div key={m.userId} style={{ marginLeft: mi > 0 ? '-8px' : '0', zIndex: 5 - mi }} className="relative">
                          <Avatar name={m.user.name} image={m.user.image} size={22} className="ring-2 ring-surface" />
                        </div>
                      ))}
                    </div>
                    <div className="ml-1">
                      <span className="text-sm font-medium text-text-primary">{team.name}</span>
                      {isMine && <span className="ml-1.5 text-xs text-accent">(내 팀)</span>}
                      <p className="text-xs text-muted">{team.members.length}/{contest.teamSize ?? 1}명{isFull ? ' · 완성' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMine && (
                      <button onClick={() => handleLeaveTeam(team.id)} className="text-xs text-text-secondary hover:text-red-400 transition-colors">탈퇴</button>
                    )}
                    {isMyLeader && (
                      <button onClick={() => handleDisbandTeam(team.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">해산</button>
                    )}
                    {!isMine && !isFull && !teams.some((t) => t.members.some((m) => m.userId === session?.user?.id)) && session?.user && ['APPROVED', 'ONGOING'].includes(contest.status) && (
                      <button onClick={() => handleJoinTeam(team.id)} className="px-3 py-1 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-dim transition-colors">참가</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info */}
      {tab === 'info' && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-2">대회 정보</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted">제한 시간</span><p className="text-text-primary font-medium">{contest.durationMin}분</p></div>
              <div><span className="text-muted">문제 수</span><p className="text-text-primary font-medium">{contest.problems.length}개</p></div>
              <div><span className="text-muted">참가자</span><p className="text-text-primary font-medium">{contest._count.participants}명</p></div>
              {contest.teamContest && <div><span className="text-muted">대회 형식</span><p className="text-text-primary font-medium">팀 대회 ({contest.teamSize}인)</p></div>}
              {contest.startTime && <div><span className="text-muted">시작</span><p className="text-text-primary font-medium">{timeAgo(contest.startTime)}</p></div>}
            </div>
          </div>
          {contest.rules && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-2">규칙</h3>
              <div className="prose-content text-sm">{contest.rules}</div>
            </div>
          )}
        </div>
      )}

      {/* Team creation modal */}
      {showTeamModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTeamModal(false)}>
            <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">팀 만들기</h3>
                <button onClick={() => setShowTeamModal(false)} className="text-muted hover:text-text-secondary"><X size={16} /></button>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">팀 이름</label>
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="팀 이름 입력"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">팀 소개 (선택)</label>
                <textarea value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} rows={2} placeholder="팀 소개"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowTeamModal(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-2 transition-colors">취소</button>
                <button onClick={handleCreateTeam} disabled={creatingTeam}
                  className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                  {creatingTeam ? '생성 중...' : '팀 생성'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

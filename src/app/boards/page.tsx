'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgo } from '@/lib/utils'
import { Plus, Layout, Globe, Lock, Layers, Trash2, Settings, X, UserPlus, Save, Users, Image as ImageIcon, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

interface BoardMember { id: string; userId: string; role: string; user: { id: string; name?: string | null; image?: string | null } }
interface Board {
  id: string; name: string; description: string; isPublic: boolean
  coverImage?: string | null
  createdAt: string; updatedAt: string; ownerId: string
  owner: { id: string; name?: string | null; image?: string | null }
  members?: BoardMember[]
  _count: { members: number; elements: number }
}

export default function BoardsPage() {
  const { data: session } = useSession()
  const [boards, setBoards] = useState<Board[]>([])
  const [myBoardIds, setMyBoardIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPublic, setNewPublic] = useState(true)
  const [creating, setCreating] = useState(false)

  // Settings modal state
  const [settingsBoard, setSettingsBoard] = useState<Board | null>(null)
  const [settingsName, setSettingsName] = useState('')
  const [settingsDesc, setSettingsDesc] = useState('')
  const [settingsPublic, setSettingsPublic] = useState(true)
  const [settingsCover, setSettingsCover] = useState<string | null>(null)
  const [settingsMembers, setSettingsMembers] = useState<BoardMember[]>([])
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviting, setInviting] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch('/api/boards')
      .then((r) => r.json())
      .then((d) => { setBoards(d.boards ?? []); setMyBoardIds(d.myBoardIds ?? []) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function createBoard() {
    if (!newName.trim()) return toast.error('보드 이름을 입력해주세요')
    setCreating(true)
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc, isPublic: newPublic }),
    })
    if (res.ok) {
      const board = await res.json()
      setBoards((p) => [board, ...p])
      setMyBoardIds((p) => [...p, board.id])
      setShowNew(false); setNewName(''); setNewDesc('')
      toast.success('보드가 생성됐습니다!')
    } else {
      toast.error((await res.json()).error ?? '생성 실패')
    }
    setCreating(false)
  }

  async function deleteBoard(boardId: string) {
    if (!confirm('정말 이 보드를 삭제하시겠습니까? 모든 요소가 영구 삭제됩니다.')) return
    const res = await fetch(`/api/boards/${boardId}`, { method: 'DELETE' })
    if (res.ok) {
      setBoards((p) => p.filter((b) => b.id !== boardId))
      setMyBoardIds((p) => p.filter((id) => id !== boardId))
      toast.success('보드가 삭제됐습니다')
    } else {
      toast.error((await res.json()).error ?? '삭제 실패')
    }
  }

  async function openSettings(board: Board) {
    setSettingsBoard(board)
    setSettingsName(board.name)
    setSettingsDesc(board.description)
    setSettingsPublic(board.isPublic)
    setSettingsCover(board.coverImage ?? null)
    setInviteQuery('')
    const res = await fetch(`/api/boards/${board.id}`)
    if (res.ok) {
      const data = await res.json()
      setSettingsMembers(data.members ?? [])
      setSettingsCover(data.coverImage ?? null)
    }
  }

  async function uploadCover(file: File) {
    setUploadingCover(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const { url } = await res.json()
      setSettingsCover(url)
    } else {
      toast.error('이미지 업로드 실패')
    }
    setUploadingCover(false)
  }

  async function saveSettings() {
    if (!settingsBoard) return
    setSavingSettings(true)
    const res = await fetch(`/api/boards/${settingsBoard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: settingsName,
        description: settingsDesc,
        isPublic: settingsPublic,
        coverImage: settingsCover,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setBoards((p) => p.map((b) => b.id === updated.id ? { ...b, ...updated } : b))
      setSettingsBoard(null)
      toast.success('설정이 저장됐습니다')
    } else {
      toast.error((await res.json()).error ?? '저장 실패')
    }
    setSavingSettings(false)
  }

  async function inviteMember() {
    if (!settingsBoard || !inviteQuery.trim()) return
    setInviting(true)
    const res = await fetch(`/api/boards/${settingsBoard.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: inviteQuery.trim() }),
    })
    if (res.ok) {
      const { member } = await res.json()
      setSettingsMembers((p) => [...p, member])
      setInviteQuery('')
      toast.success(`${member.user.name}님을 초대했습니다`)
    } else {
      toast.error((await res.json()).error ?? '초대 실패')
    }
    setInviting(false)
  }

  async function removeMember(userId: string) {
    if (!settingsBoard) return
    const res = await fetch(`/api/boards/${settingsBoard.id}/invite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setSettingsMembers((p) => p.filter((m) => m.userId !== userId))
      toast.success('멤버를 제거했습니다')
    } else {
      toast.error('제거 실패')
    }
  }

  const myBoards = boards.filter((b) => myBoardIds.includes(b.id))
  const otherBoards = boards.filter((b) => !myBoardIds.includes(b.id))
  const isOwnerOrAdmin = (b: Board) =>
    session?.user?.id === b.ownerId || session?.user?.role === 'ADMIN'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Layout size={22} className="text-accent" /> 보드
          </h1>
          <p className="text-sm text-text-secondary mt-1">함께 쓰는 무한 화이트보드</p>
        </div>
        {session?.user && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors">
            <Plus size={15} /> 보드 만들기
          </button>
        )}
      </div>

      {/* New board modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNew(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text-primary mb-4">새 보드 만들기</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">보드 이름 *</label>
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createBoard()}
                  placeholder="예: 수학 스터디 보드"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">설명 (선택)</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="보드에 대한 설명"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="rounded" />
                <span className="text-sm text-text-primary">공개 보드 (누구나 볼 수 있음)</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-2 transition-colors">취소</button>
              <button onClick={createBoard} disabled={creating}
                className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                {creating ? '생성 중...' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSettingsBoard(null)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">보드 설정</h2>
              <button onClick={() => setSettingsBoard(null)} className="text-muted hover:text-text-secondary"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* ── 표지 이미지 ── */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">표지 이미지</label>
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border bg-surface-2 group">
                  {settingsCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settingsCover} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted">
                      <ImageIcon size={28} />
                      <span className="text-xs">표지 이미지 없음</span>
                    </div>
                  )}
                  {/* Overlay buttons */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-gray-900 text-xs font-semibold hover:bg-white transition-colors disabled:opacity-60">
                      <Upload size={13} /> {uploadingCover ? '업로드 중...' : '이미지 선택'}
                    </button>
                    {settingsCover && (
                      <button
                        onClick={() => setSettingsCover(null)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/80 text-white text-xs font-semibold hover:bg-red-500 transition-colors">
                        <X size={12} /> 제거
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }}
                />
                <p className="text-[11px] text-muted mt-1.5">보드 목록에서 카드 상단에 표시됩니다</p>
              </div>

              {/* Basic info */}
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">보드 이름</label>
                  <input value={settingsName} onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">설명</label>
                  <input value={settingsDesc} onChange={(e) => setSettingsDesc(e.target.value)}
                    placeholder="설명 없음"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={settingsPublic} onChange={(e) => setSettingsPublic(e.target.checked)} className="rounded" />
                  <span className="text-sm text-text-primary">공개 보드</span>
                  <span className="text-xs text-muted">(누구나 접근 가능)</span>
                </label>
              </div>

              {/* Member management */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={14} className="text-muted" />
                  <span className="text-sm font-semibold text-text-secondary">멤버 관리</span>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-lg mb-2">
                  <Avatar name={settingsBoard.owner.name} image={settingsBoard.owner.image} size={24} />
                  <span className="text-sm text-text-primary flex-1">{settingsBoard.owner.name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium">소유자</span>
                </div>

                {/* Members */}
                {settingsMembers.filter((m) => m.userId !== settingsBoard.ownerId).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-2 group">
                    <Avatar name={m.user.name} image={m.user.image} size={24} />
                    <span className="text-sm text-text-primary flex-1">{m.user.name}</span>
                    <span className="text-xs text-muted">{m.role === 'EDITOR' ? '편집자' : m.role}</span>
                    <button onClick={() => removeMember(m.userId)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all">
                      <X size={13} />
                    </button>
                  </div>
                ))}

                {/* Invite */}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">멤버 초대</label>
                  <div className="flex gap-2">
                    <input value={inviteQuery} onChange={(e) => setInviteQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
                      placeholder="이름 또는 이메일"
                      className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-muted focus:outline-none focus:border-accent" />
                    <button onClick={inviteMember} disabled={inviting || !inviteQuery.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                      <UserPlus size={12} /> {inviting ? '...' : '초대'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setSettingsBoard(null)} className="flex-1 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-2 transition-colors">취소</button>
              <button onClick={saveSettings} disabled={savingSettings || uploadingCover}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dim transition-colors disabled:opacity-50">
                <Save size={13} /> {savingSettings ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {myBoards.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-text-secondary mb-3">내 보드</h2>
              <div className="flex flex-col gap-2">
                {myBoards.map((b) => (
                  <BoardCard key={b.id} board={b} isMine canManage={isOwnerOrAdmin(b)}
                    onDelete={() => deleteBoard(b.id)}
                    onSettings={() => openSettings(b)} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">
              공개 보드 ({otherBoards.length})
            </h2>
            {otherBoards.length === 0 ? (
              <div className="text-center py-16 text-text-secondary text-sm">
                {myBoards.length === 0 ? '아직 보드가 없습니다. 첫 번째 보드를 만들어보세요!' : '다른 공개 보드가 없습니다'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {otherBoards.map((b) => (
                  <BoardCard key={b.id} board={b} isMine={false} canManage={isOwnerOrAdmin(b)}
                    onDelete={() => deleteBoard(b.id)}
                    onSettings={() => openSettings(b)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function BoardCard({ board, isMine, canManage, onDelete, onSettings }: {
  board: Board; isMine: boolean; canManage: boolean
  onDelete: () => void; onSettings: () => void
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-border hover:border-accent/40 bg-surface transition-all">
      <Link href={`/boards/${board.id}`} className="block">

        {/* Cover image — 표지 있을 때만 */}
        {board.coverImage && (
          <div className="w-full h-28 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={board.coverImage}
              alt="cover"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        )}

        <div className={`flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 transition-colors ${board.coverImage ? '' : ''}`}>
          {/* Icon — 표지 없을 때만 */}
          {!board.coverImage && (
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Layers size={18} className="text-accent" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary group-hover:text-accent transition-colors text-sm truncate">
                {board.name}
              </span>
              {board.isPublic
                ? <Globe size={11} className="text-muted shrink-0" />
                : <Lock size={11} className="text-muted shrink-0" />}
              {isMine && (
                <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium shrink-0">내 보드</span>
              )}
            </div>
            {board.description && (
              <p className="text-xs text-muted mt-0.5 truncate">{board.description}</p>
            )}
          </div>

          {/* Meta */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted shrink-0">
            <span className="flex items-center gap-1">
              <Avatar name={board.owner.name} image={board.owner.image} size={14} />
              {board.owner.name}
            </span>
            <span>{board._count.elements}개</span>
            <span>{timeAgo(board.updatedAt)}</span>
          </div>

          {/* Right padding for buttons */}
          {canManage && <div className="w-14 shrink-0" />}
        </div>
      </Link>

      {/* Settings & Delete buttons */}
      {canManage && (
        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSettings() }}
            className="p-1.5 rounded-lg bg-surface/80 backdrop-blur-sm border border-border text-muted hover:text-text-primary hover:border-accent/40 transition-colors"
            title="설정">
            <Settings size={13} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-surface/80 backdrop-blur-sm border border-border text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
            title="삭제">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

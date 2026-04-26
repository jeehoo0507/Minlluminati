'use client'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import {
  MousePointer2, Type, StickyNote, Image as ImageIcon,
  ZoomIn, ZoomOut, Maximize2, Trash2, ArrowLeft, Save,
  Lock, Globe, Pencil, X, AlignLeft, Minus, Plus, Pen, Shapes,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { nanoid } from 'nanoid'
import { Avatar } from '@/components/ui/Avatar'
import type { PresenceUser, BoardSSEEvent } from '@/lib/boardEvents'

// ─── Types ───────────────────────────────────────────────────────────
type ElementType = 'TEXT' | 'STICKY' | 'IMAGE' | 'SHAPE' | 'PEN'
type Tool = 'select' | 'text' | 'sticky' | 'image' | 'shape' | 'pen'
type ShapeType = 'rect' | 'circle' | 'triangle' | 'diamond' | 'star' | 'speech' | 'arrow-right' | 'hexagon'

interface StyleData {
  color?: string
  bgColor?: string
  fontSize?: number
  textAlign?: string
  borderRadius?: number
  strokeColor?: string
  strokeWidth?: number
  shapeType?: ShapeType
  opacity?: number
}

interface BoardElement {
  id: string; type: ElementType
  x: number; y: number; width: number; height: number
  content: string; style: StyleData; zIndex: number
}

interface BoardData {
  id: string; name: string; description: string; isPublic: boolean; ownerId: string
  owner: { id: string; name?: string | null; image?: string | null }
  members: Array<{ userId: string }>
  elements: Array<{ id: string; type: string; x: number; y: number; width: number; height: number; content: string; style: string; zIndex: number }>
}

// ─── Palettes ─────────────────────────────────────────────────────────
const STICKY_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fda4af', '#c4b5fd', '#fdba74', '#a5f3fc']
const SHAPE_COLORS  = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
const PEN_COLORS    = ['#111827', '#374151', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
const TEXT_COLORS   = ['#111827', '#374151', '#6b7280', '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#f9fafb']

const SHAPES: { type: ShapeType; label: string; path: (w: number, h: number) => string }[] = [
  { type: 'rect',        label: '직사각형', path: () => '' },
  { type: 'circle',      label: '원',       path: () => '' },
  { type: 'triangle',    label: '삼각형',   path: (w, h) => `polygon(50% 0%, 0% 100%, 100% 100%)` },
  { type: 'diamond',     label: '마름모',   path: (w, h) => `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)` },
  { type: 'star',        label: '별',       path: (w, h) => `polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)` },
  { type: 'speech',      label: '말풍선',   path: () => '' },
  { type: 'arrow-right', label: '화살표',   path: (w, h) => `polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)` },
  { type: 'hexagon',     label: '육각형',   path: (w, h) => `polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)` },
]

const MIN_ZOOM = 0.1; const MAX_ZOOM = 5
const GRID_SIZE = 24; const AUTOSAVE_DELAY = 800
const CURSOR_THROTTLE = 50 // ms

// ─── Main Component ─────────────────────────────────────────────────
export default function BoardCanvas() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()

  const [pan, setPan]   = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [board, setBoard]     = useState<BoardData | null>(null)
  const [elements, setElements] = useState<BoardElement[]>([])
  const [loading, setLoading]   = useState(true)

  const [tool, setTool]         = useState<Tool>('select')
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [penWidth, setPenWidth] = useState(3)
  const [shapeType, setShapeType] = useState<ShapeType>('rect')
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId]     = useState<string | null>(null)

  const [isDragging, setIsDragging]       = useState(false)
  const [isResizing, setIsResizing]       = useState(false)
  const [isPanning, setIsPanning]         = useState(false)
  const [isDrawingPen, setIsDrawingPen]   = useState(false)
  const isDrawingPenRef      = useRef(false)
  const drawingPointerIdRef  = useRef<number | null>(null)   // 드로잉 중인 포인터 ID
  const drawingPointerTypeRef = useRef<string | null>(null)  // 'pen' | 'touch' | 'mouse'
  const lastPenTimeRef       = useRef(0)  // 마지막 pen 포인터 이벤트 시각 — 시간 기반 팜 리젝션
  const isDraggingRef        = useRef(false)
  const isResizingRef        = useRef(false)
  const [isRectSelecting, setIsRectSelecting] = useState(false)
  const [selRect, setSelRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Real-time presence
  const [presence, setPresence]           = useState<Record<string, PresenceUser>>({})
  const presenceRef = useRef<Record<string, PresenceUser>>({}) // stale-closure fix
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { cursorX: number; cursorY: number; name: string; color: string }>>({})
  const [followingId, setFollowingId]     = useState<string | null>(null)
  const [showPresenceMenu, setShowPresenceMenu] = useState(false)
  const [sseConnected, setSseConnected]   = useState(false)

  // Undo / Redo
  const undoStack = useRef<BoardElement[][]>([])
  const redoStack = useRef<BoardElement[][]>([])

  // Copy/Paste clipboard
  const clipboardRef = useRef<BoardElement[]>([])

  // 삭제된 요소 ID 추적 — 명시적 delete만 서버에 전송 (notIn 삭제 경쟁 방지)
  const deletedIdsRef = useRef<string[]>([])
  // SSE 머지 후 로컬 요소가 보존됐을 때 re-save 예약
  const pendingResaveRef = useRef<BoardElement[] | null>(null)

  // Touch gesture state for iPad two-finger pan/pinch
  const touchRef = useRef<{ id0: number; id1: number; x0: number; y0: number; x1: number; y1: number } | null>(null)
  const isGesturingRef = useRef(false) // true while 2-finger gesture is active → block pointer events

  const wrapperRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autosaveRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirty      = useRef(false)
  const spaceHeld    = useRef(false)
  const zIndexCounter = useRef(1)

  const dragStartRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const multiOrigRef = useRef<Map<string, { x: number; y: number }> | null>(null)
  const multiOrigSnapRef = useRef<BoardElement[] | null>(null) // undo snapshot before drag
  const resizeRef    = useRef<{ corner: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null)
  const resizeSnapRef = useRef<BoardElement[] | null>(null) // undo snapshot before resize
  const panRef       = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)
  const selRectStartRef = useRef<{ x: number; y: number } | null>(null)

  const drawingPointsRef = useRef<{ x: number; y: number }[]>([])
  const livePathRef      = useRef<SVGPathElement | null>(null)
  const penColorRef      = useRef(penColor)
  const penWidthRef      = useRef(penWidth)
  useEffect(() => { penColorRef.current = penColor }, [penColor])
  useEffect(() => { penWidthRef.current = penWidth }, [penWidth])

  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panRef2  = useRef(pan)
  const zoomRef2 = useRef(zoom)
  useEffect(() => { panRef2.current = pan }, [pan])
  useEffect(() => { zoomRef2.current = zoom }, [zoom])
  useEffect(() => { presenceRef.current = presence }, [presence])

  // ── Load board ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/boards/${id}`).then((r) => r.json()).then((data: BoardData) => {
      setBoard(data)
      const els: BoardElement[] = data.elements.map((el) => ({
        ...el, type: el.type as ElementType,
        style: typeof el.style === 'string' ? JSON.parse(el.style || '{}') : el.style,
      }))
      setElements(els)
      zIndexCounter.current = els.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1
      if (data.isPublic) fetch(`/api/boards/${id}/elements`, { method: 'POST' }).catch(() => {})
    }).catch(() => toast.error('보드를 불러올 수 없습니다')).finally(() => setLoading(false))
  }, [id])

  // ── SSE real-time connection ───────────────────────────────────────
  useEffect(() => {
    if (!session?.user) return
    const es = new EventSource(`/api/boards/${id}/stream`)

    es.onopen = () => setSseConnected(true)
    es.onmessage = (e) => {
      const event: BoardSSEEvent = JSON.parse(e.data)
      const myId = session.user.id

      if (event.type === 'presence') {
        setPresence(event.users)
      } else if (event.type === 'join') {
        setPresence((prev) => ({ ...prev, [event.user.userId]: event.user }))
        if (event.user.userId !== myId) toast(`${event.user.name}님이 참가했습니다`, { icon: '👋', duration: 2000 })
      } else if (event.type === 'leave') {
        setPresence((prev) => { const n = { ...prev }; delete n[event.userId]; return n })
        setRemoteCursors((prev) => { const n = { ...prev }; delete n[event.userId]; return n })
      } else if (event.type === 'cursor') {
        // Update remote cursor display (use ref to avoid stale closure)
        const p = presenceRef.current[event.userId]
        setRemoteCursors((prev) => ({
          ...prev,
          [event.userId]: {
            cursorX: event.cursorX, cursorY: event.cursorY,
            name: p?.name ?? '?',
            color: p?.color ?? '#6b7280',
          },
        }))
        // Follow mode
        setFollowingId((fid) => {
          if (fid === event.userId) {
            setPan({ x: event.panX, y: event.panY })
            setZoom(event.zoom)
          }
          return fid
        })
      } else if (event.type === 'elements' && event.userId !== myId) {
        // 다른 유저가 저장한 상태를 받아 스마트 병합
        const incoming = (event.elements as BoardElement[]).map((el: BoardElement) => ({
          ...el, type: el.type as ElementType,
          style: typeof el.style === 'string' ? JSON.parse(el.style || '{}') : el.style,
        }))
        const remoteDeletedIds: string[] = (event as { deletedIds?: string[] }).deletedIds ?? []
        const deletedSet = new Set(remoteDeletedIds)

        setElements((prev) => {
          if (isDrawingPenRef.current) return prev

          const remoteIds = new Set(incoming.map((e) => e.id))
          // 로컬에만 있는 요소 보존 (상대방이 명시적으로 삭제한 것은 제외)
          const localOnly = prev.filter((el) => !remoteIds.has(el.id) && !deletedSet.has(el.id))

          // 드래그 중인 요소는 로컬 위치 우선
          const activeIds: Set<string> = isDraggingRef.current && multiOrigRef.current
            ? new Set(Array.from(multiOrigRef.current.keys()))
            : new Set()

          const merged = incoming
            .filter((el) => !deletedSet.has(el.id))
            .map((el) => activeIds.has(el.id) ? (prev.find((p) => p.id === el.id) ?? el) : el)

          const next = [...merged, ...localOnly]
          if (localOnly.length > 0) pendingResaveRef.current = next
          return next
        })
      }
    }

    es.onerror = () => { setSseConnected(false) }

    return () => { es.close(); setSseConnected(false) }
  }, [id, session?.user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Autosave ──────────────────────────────────────────────────────
  const save = useCallback(async (els: BoardElement[]) => {
    // 명시적으로 삭제된 ID만 서버에 전달 (다른 유저 요소 삭제 경쟁 방지)
    const deletedIds = [...deletedIdsRef.current]
    deletedIdsRef.current = [] // 낙관적 클리어 (실패 시 복원)
    const res = await fetch(`/api/boards/${id}/elements`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: els.map((el) => ({ ...el, style: JSON.stringify(el.style) })),
        deletedIds,
      }),
    })
    if (!res.ok) {
      deletedIdsRef.current = [...deletedIds, ...deletedIdsRef.current] // 실패 시 복원
      toast.error('저장 실패')
    } else {
      isDirty.current = false
    }
  }, [id])

  const scheduleSave = useCallback((els: BoardElement[]) => {
    isDirty.current = true
    if (autosaveRef.current) clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(() => save(els), AUTOSAVE_DELAY)
  }, [save])

  useEffect(() => () => { if (autosaveRef.current) clearTimeout(autosaveRef.current) }, [])

  // SSE 머지 후 로컬 요소 보존 시 re-save 예약 처리
  useEffect(() => {
    if (pendingResaveRef.current) {
      const els = pendingResaveRef.current
      pendingResaveRef.current = null
      scheduleSave(els)
    }
  }, [elements, scheduleSave]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 스타일러스 stroke stuck 안전망 ────────────────────────────────
  // setPointerCapture 실패 또는 캔버스 밖 pointerup 발생 시 drawing state 강제 초기화
  useEffect(() => {
    const onGlobalUp = (e: PointerEvent) => {
      if (!isDrawingPenRef.current) return
      if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return
      // React onPointerUp이 이미 처리했다면 isDrawingPenRef가 false — 이 경우 early return함
      isDrawingPenRef.current = false
      setIsDrawingPen(false)
      drawingPointerIdRef.current = null
      drawingPointerTypeRef.current = null
      drawingPointsRef.current = []
      if (livePathRef.current) livePathRef.current.setAttribute('d', '')
    }
    window.addEventListener('pointerup', onGlobalUp)
    window.addEventListener('pointercancel', onGlobalUp)
    return () => {
      window.removeEventListener('pointerup', onGlobalUp)
      window.removeEventListener('pointercancel', onGlobalUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cursor broadcast ──────────────────────────────────────────────
  const broadcastCursor = useCallback((wx: number, wy: number) => {
    if (cursorThrottleRef.current) return
    cursorThrottleRef.current = setTimeout(() => {
      fetch(`/api/boards/${id}/cursor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursorX: wx, cursorY: wy, panX: panRef2.current.x, panY: panRef2.current.y, zoom: zoomRef2.current }),
      }).catch(() => {})
      cursorThrottleRef.current = null
    }, CURSOR_THROTTLE)
  }, [id])

  // ── Coords ────────────────────────────────────────────────────────
  function screenToWorld(sx: number, sy: number) {
    const rect = wrapperRef.current!.getBoundingClientRect()
    const p = panRef2.current; const z = zoomRef2.current
    return { x: (sx - rect.left - p.x) / z, y: (sy - rect.top - p.y) / z }
  }

  // ── Zoom ──────────────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const rect = wrapperRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left; const cy = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1.1 : 0.9
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta))
        setPan((p) => ({ x: cx - (cx - p.x) * (next / z), y: cy - (cy - p.y) * (next / z) }))
        return next
      })
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
  }

  // ── Touch gestures (iPad two-finger pan + pinch zoom) ────────────
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      // Apple Pencil 스트로크 중에만 두 손가락 제스처 무시 (손가락으로 쓰는 중엔 허용)
      if (isDrawingPenRef.current && drawingPointerTypeRef.current === 'pen') return
      e.preventDefault()
      isGesturingRef.current = true
      setIsDragging(false); setIsPanning(false); setIsRectSelecting(false)
      const t0 = e.touches[0]; const t1 = e.touches[1]
      touchRef.current = { id0: t0.identifier, id1: t1.identifier, x0: t0.clientX, y0: t0.clientY, x1: t1.clientX, y1: t1.clientY }
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault()
      const t = touchRef.current
      const rect = wrapperRef.current!.getBoundingClientRect()
      const cur0 = e.touches[0]; const cur1 = e.touches[1]

      // Previous midpoint + distance
      const prevMidX = (t.x0 + t.x1) / 2; const prevMidY = (t.y0 + t.y1) / 2
      const prevDist = Math.hypot(t.x1 - t.x0, t.y1 - t.y0)

      // Current midpoint + distance
      const curMidX = (cur0.clientX + cur1.clientX) / 2; const curMidY = (cur0.clientY + cur1.clientY) / 2
      const curDist = Math.hypot(cur1.clientX - cur0.clientX, cur1.clientY - cur0.clientY)

      // Scale change
      const scaleRatio = prevDist > 0 ? curDist / prevDist : 1
      const cx = curMidX - rect.left; const cy = curMidY - rect.top

      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * scaleRatio))
        // Pan: follow midpoint movement + zoom-around-midpoint
        const dx = curMidX - prevMidX; const dy = curMidY - prevMidY
        setPan((p) => ({
          x: cx - (cx - p.x) * (next / z) + dx,
          y: cy - (cy - p.y) * (next / z) + dy,
        }))
        return next
      })

      touchRef.current = { id0: t.id0, id1: t.id1, x0: cur0.clientX, y0: cur0.clientY, x1: cur1.clientX, y1: cur1.clientY }
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) {
      touchRef.current = null
      // Short delay before re-enabling pointer events to prevent stray pointer-up from being processed
      setTimeout(() => { isGesturingRef.current = false }, 80)
    }
  }

  function zoomTo(v: number) {
    const rect = wrapperRef.current!.getBoundingClientRect()
    const cx = rect.width / 2; const cy = rect.height / 2
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v))
      setPan((p) => ({ x: cx - (cx - p.x) * (next / z), y: cy - (cy - p.y) * (next / z) }))
      return next
    })
  }
  function resetView() { setPan({ x: 0, y: 0 }); setZoom(1) }

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !editingId) {
        e.preventDefault(); spaceHeld.current = true
        if (wrapperRef.current) wrapperRef.current.style.cursor = 'grab'
      }
      if (e.key === 'Escape') {
        setSelectedIds([]); setEditingId(null); setTool('select')
        setShowShapeMenu(false); setFollowingId(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !editingId) deleteElements(selectedIds)
      if (!editingId) {
        if (e.key === 'v') setTool('select')
        if (e.key === 't') setTool('text')
        if (e.key === 's') setTool('sticky')
        if (e.key === 'p') setTool('pen')
        if (e.key === 'r') setTool('shape')
        if (e.key === 'i') setTool('image')
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); setSelectedIds(elements.map((el) => el.id)) }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedIds.length > 0) {
          e.preventDefault()
          clipboardRef.current = elements.filter((el) => selectedIds.includes(el.id))
          toast('복사됨', { icon: '📋', duration: 1000 })
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardRef.current.length > 0) {
          e.preventDefault()
          const offset = 20
          const pasted = clipboardRef.current.map((el) => ({
            ...el, id: nanoid(), x: el.x + offset, y: el.y + offset, zIndex: zIndexCounter.current++,
          }))
          setElements((p) => { pushUndo(p); const next = [...p, ...pasted]; scheduleSave(next); return next })
          setSelectedIds(pasted.map((el) => el.id))
          clipboardRef.current = pasted // shift next paste
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') { spaceHeld.current = false; if (wrapperRef.current) wrapperRef.current.style.cursor = '' }
    }
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [selectedIds, editingId, elements]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas pointer events ─────────────────────────────────────────
  function onCanvasPointerDown(e: React.PointerEvent) {
    // 두 손가락 제스처 중에는 터치 포인터만 무시 (펜/마우스는 항상 허용)
    if (isGesturingRef.current && e.pointerType === 'touch') return
    if (e.button !== 0 && e.button !== 1) return
    setShowShapeMenu(false)

    if (e.button === 1 || spaceHeld.current) {
      setIsPanning(true)
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    if (tool === 'pen') {
      // ① 시간 기반 팜 리젝션: pen 입력이 있었던 300ms 이내 touch는 팜으로 간주하여 무시
      if (e.pointerType === 'touch' && Date.now() - lastPenTimeRef.current < 300) return
      // pen 이벤트 시각 갱신
      if (e.pointerType === 'pen') lastPenTimeRef.current = Date.now()

      if (isDrawingPenRef.current) {
        // 터치(손바닥/ghost) → 항상 차단
        if (e.pointerType === 'touch') return
        // 마우스 등 비-펜 → 차단
        if (e.pointerType !== 'pen') return
        // pen pointerdown인데 이미 드로잉 중 = stuck 또는 ghost → 강제 초기화 후 새 스트로크 시작
        // ★ 이 케이스가 "펜→펜" stuck 상태에서 계속 씹히던 버그의 원인
        isDrawingPenRef.current = false
        drawingPointerIdRef.current = null
        drawingPointerTypeRef.current = null
        drawingPointsRef.current = []
        if (livePathRef.current) livePathRef.current.setAttribute('d', '')
        // fall through → 아래에서 새 pen 스트로크 시작
      }
      e.preventDefault()
      const pos = screenToWorld(e.clientX, e.clientY)
      drawingPointsRef.current = [pos]
      setIsDrawingPen(true); isDrawingPenRef.current = true
      drawingPointerIdRef.current  = e.pointerId
      drawingPointerTypeRef.current = e.pointerType
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop — 일부 기기 InvalidStateError 방어 */ }
      if (livePathRef.current) {
        livePathRef.current.setAttribute('d', `M ${pos.x} ${pos.y}`)
        livePathRef.current.setAttribute('stroke', penColorRef.current)
        livePathRef.current.setAttribute('stroke-width', String((penWidthRef.current / zoomRef2.current).toFixed(2)))
      }
      return
    }

    if (tool !== 'select') {
      const pos = screenToWorld(e.clientX, e.clientY)
      const newEl = makeElement(tool, pos.x, pos.y)
      if (!newEl) { if (tool === 'image') fileInputRef.current?.click(); return }
      addElement(newEl); setTool('select')
      setSelectedIds([newEl.id])
      if (newEl.type === 'TEXT' || newEl.type === 'STICKY') setEditingId(newEl.id)
      return
    }

    // Rubber-band selection
    setEditingId(null); setSelectedIds([])
    const pos = screenToWorld(e.clientX, e.clientY)
    selRectStartRef.current = pos
    setSelRect({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
    setIsRectSelecting(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (isGesturingRef.current && e.pointerType === 'touch') return // 터치만 무시, 펜은 허용

    // pen 호버/이동 시각 갱신 — 팜 리젝션 300ms 윈도우 유지
    if (e.pointerType === 'pen') lastPenTimeRef.current = Date.now()

    // getBoundingClientRect 는 한 번만 계산 (coalesced loop 마다 호출하면 레이아웃 강제 재계산 → Apple Pencil 지연)
    const rect = wrapperRef.current!.getBoundingClientRect()
    const _p = panRef2.current; const _z = zoomRef2.current
    const toWorld = (sx: number, sy: number) => ({ x: (sx - rect.left - _p.x) / _z, y: (sy - rect.top - _p.y) / _z })

    const pos = toWorld(e.clientX, e.clientY)
    broadcastCursor(pos.x, pos.y)

    if (isPanning && panRef.current) {
      const dx = e.clientX - panRef.current.startX; const dy = e.clientY - panRef.current.startY
      setPan({ x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy })
    }
    if (isDrawingPenRef.current && livePathRef.current) {
      // Apple Pencil 스트로크 중 터치(손바닥) pointermove 무시
      if (drawingPointerTypeRef.current === 'pen' && e.pointerType === 'touch') return
      // 드로잉 시작한 포인터 ID가 아니면 무시
      if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return

      // 코얼레스드 이벤트로 고주파 입력 수집
      // getCoalescedEvents()가 빈 배열을 반환하는 기기(Galaxy 등) 대응 — 현재 이벤트를 fallback으로 사용
      const raw = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? []
      const events = raw.length > 0 ? raw : [e.nativeEvent as PointerEvent]

      const pts = drawingPointsRef.current
      const prevLen = pts.length
      for (const ce of events) {
        pts.push(toWorld(ce.clientX, ce.clientY)) // 캐시된 rect 재사용 (getBoundingClientRect 반복 호출 없음)
      }
      if (pts.length < 2) return

      // 증분 업데이트: 처음엔 전체, 이후엔 마지막 세그먼트만 추가 (빠른 쓰기 최적화)
      if (prevLen < 2) {
        // 초기 — 전체 path 재구성
        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i - 1]; const c = pts[i]
          d += ` Q ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + c.x) / 2).toFixed(1)} ${((p.y + c.y) / 2).toFixed(1)}`
        }
        livePathRef.current.setAttribute('d', d)
      } else {
        // 증분 — 기존 d에 새 세그먼트만 append
        let d = livePathRef.current.getAttribute('d') ?? ''
        for (let i = prevLen; i < pts.length; i++) {
          const p = pts[i - 1]; const c = pts[i]
          d += ` Q ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + c.x) / 2).toFixed(1)} ${((p.y + c.y) / 2).toFixed(1)}`
        }
        livePathRef.current.setAttribute('d', d)
      }
      // stroke 속성은 pointerdown 시 이미 설정됨 → 매 move 마다 반복 설정 불필요
    }
    if (isRectSelecting && selRectStartRef.current) {
      setSelRect({ x1: selRectStartRef.current.x, y1: selRectStartRef.current.y, x2: pos.x, y2: pos.y })
    }
    if (isDragging && dragStartRef.current && multiOrigRef.current) {
      const dx = (e.clientX - dragStartRef.current.clientX) / zoom
      const dy = (e.clientY - dragStartRef.current.clientY) / zoom
      setElements((prev) => prev.map((el) => {
        const orig = multiOrigRef.current!.get(el.id); if (!orig) return el
        return { ...el, x: orig.x + dx, y: orig.y + dy }
      }))
    }
    if (isResizing && resizeRef.current) {
      const { corner, startX, startY, origX, origY, origW, origH } = resizeRef.current
      const dx = (e.clientX - startX) / zoom; const dy = (e.clientY - startY) / zoom
      setElements((prev) => prev.map((el) => {
        if (el.id !== selectedIds[0]) return el
        let { x, y, width, height } = el
        if (corner.includes('e')) width  = Math.max(40, origW + dx)
        if (corner.includes('s')) height = Math.max(30, origH + dy)
        if (corner.includes('w')) { x = origX + dx; width  = Math.max(40, origW - dx) }
        if (corner.includes('n')) { y = origY + dy; height = Math.max(30, origH - dy) }
        return { ...el, x, y, width, height }
      }))
    }
  }

  function onCanvasPointerUp(e: React.PointerEvent) {
    if (isGesturingRef.current && e.pointerType === 'touch') return // 터치만 무시
    if (isPanning) { setIsPanning(false); panRef.current = null }

    if (isDrawingPenRef.current) {
      // 드로잉 시작한 포인터가 아닌 포인터의 up 이벤트는 무시 (손바닥이 먼저 들려도 스트로크 유지)
      if (drawingPointerIdRef.current !== null && e.pointerId !== drawingPointerIdRef.current) return
      setIsDrawingPen(false); isDrawingPenRef.current = false
      drawingPointerIdRef.current = null
      drawingPointerTypeRef.current = null  // 다음 스트로크가 항상 올바른 타입으로 시작되도록 초기화
      const pts = drawingPointsRef.current
      if (livePathRef.current) livePathRef.current.setAttribute('d', '')
      if (pts.length >= 2) {
        const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y)
        const minX = Math.min(...xs); const minY = Math.min(...ys)
        const maxX = Math.max(...xs); const maxY = Math.max(...ys)
        const pad = 8
        const rel = pts.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad }))
        let d = `M ${rel[0].x} ${rel[0].y}`
        for (let i = 1; i < rel.length; i++) {
          const p = rel[i - 1]; const c = rel[i]
          d += ` Q ${p.x} ${p.y} ${(p.x + c.x) / 2} ${(p.y + c.y) / 2}`
        }
        const el: BoardElement = {
          id: nanoid(), type: 'PEN',
          x: minX - pad, y: minY - pad,
          width: maxX - minX + pad * 2, height: maxY - minY + pad * 2,
          content: d,
          style: { strokeColor: penColorRef.current, strokeWidth: penWidthRef.current },
          zIndex: zIndexCounter.current++,
        }
        addElement(el)
        // 펜 모드: 선택하지 않고 계속 필기할 수 있도록 (툴바 표시 방지)
      }
      drawingPointsRef.current = []
    }

    if (isRectSelecting) {
      setIsRectSelecting(false)
      if (selRect) {
        const left = Math.min(selRect.x1, selRect.x2); const right = Math.max(selRect.x1, selRect.x2)
        const top = Math.min(selRect.y1, selRect.y2); const bottom = Math.max(selRect.y1, selRect.y2)
        if (right - left > 4 || bottom - top > 4) {
          setSelectedIds(elements.filter((el) =>
            el.x < right && el.x + el.width > left && el.y < bottom && el.y + el.height > top
          ).map((el) => el.id))
        }
      }
      setSelRect(null); selRectStartRef.current = null
    }

    if (isDragging) {
      setIsDragging(false); isDraggingRef.current = false
      setElements((cur) => { pushUndo(multiOrigSnapRef.current ?? cur); scheduleSave(cur); return cur })
      multiOrigRef.current = null; dragStartRef.current = null; multiOrigSnapRef.current = null
    }
    if (isResizing) {
      setIsResizing(false); isResizingRef.current = false
      setElements((cur) => { pushUndo(resizeSnapRef.current ?? cur); scheduleSave(cur); return cur })
      resizeRef.current = null; resizeSnapRef.current = null
    }
  }

  // ── Element helpers ───────────────────────────────────────────────
  function makeElement(t: Tool, x: number, y: number): BoardElement | null {
    const base = { id: nanoid(), x, y, zIndex: zIndexCounter.current++ }
    if (t === 'text')   return { ...base, type: 'TEXT',   width: 200, height: 60,  content: '텍스트 입력', style: { fontSize: 16, color: '#111827' } }
    if (t === 'sticky') return { ...base, type: 'STICKY', width: 200, height: 180, content: '메모', style: { bgColor: '#fef08a', fontSize: 14 } }
    if (t === 'shape')  return { ...base, type: 'SHAPE',  width: 160, height: 120, content: '', style: { bgColor: '#3b82f6', shapeType } }
    return null
  }

  function pushUndo(prev: BoardElement[]) {
    undoStack.current.push(prev)
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
  }

  function addElement(el: BoardElement) {
    setElements((p) => { pushUndo(p); const next = [...p, el]; scheduleSave(next); return next })
  }
  function deleteElements(ids: string[]) {
    // 삭제 ID를 명시적으로 추적 → save 시 서버에 전달
    const merged = deletedIdsRef.current.concat(ids)
    deletedIdsRef.current = merged.filter((id, i) => merged.indexOf(id) === i) // dedupe
    setElements((p) => { pushUndo(p); const next = p.filter((el) => !ids.includes(el.id)); scheduleSave(next); return next })
    setSelectedIds([]); setEditingId(null)
  }
  function updateElement(elId: string, patch: Partial<BoardElement>) {
    setElements((p) => { const next = p.map((el) => el.id === elId ? { ...el, ...patch } : el); scheduleSave(next); return next })
  }
  function bringToFront(ids: string[]) {
    setElements((p) => p.map((el) => ids.includes(el.id) ? { ...el, zIndex: zIndexCounter.current++ } : el))
  }
  function undo() {
    const prev = undoStack.current.pop(); if (!prev) return
    setElements((cur) => {
      redoStack.current.push(cur)
      // undo로 복원되는 요소(삭제 취소)는 deletedIdsRef에서 제거
      const curIdSet = new Set(cur.map((e) => e.id))
      const restored = prev.filter((e) => !curIdSet.has(e.id)).map((e) => e.id)
      if (restored.length > 0) {
        const restoredSet = new Set(restored)
        deletedIdsRef.current = deletedIdsRef.current.filter((id) => !restoredSet.has(id))
      }
      scheduleSave(prev)
      return prev
    })
    setSelectedIds([])
  }
  function redo() {
    const next = redoStack.current.pop(); if (!next) return
    setElements((cur) => { undoStack.current.push(cur); scheduleSave(next); return next })
    setSelectedIds([])
  }

  // ── Element pointer ───────────────────────────────────────────────
  function onElementPointerDown(e: React.PointerEvent, el: BoardElement) {
    if (spaceHeld.current || isPanning || tool === 'pen') return
    e.stopPropagation()
    const newSel = e.shiftKey
      ? (selectedIds.includes(el.id) ? selectedIds.filter((id) => id !== el.id) : [...selectedIds, el.id])
      : (selectedIds.includes(el.id) ? selectedIds : [el.id])
    setSelectedIds(newSel)
    if (editingId === el.id) return
    setIsDragging(true); isDraggingRef.current = true
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY }
    const ids = newSel.includes(el.id) ? newSel : [el.id]
    multiOrigRef.current = new Map(elements.filter((e2) => ids.includes(e2.id)).map((e2) => [e2.id, { x: e2.x, y: e2.y }]))
    multiOrigSnapRef.current = elements
    bringToFront(ids)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onResizePointerDown(e: React.PointerEvent, el: BoardElement, corner: string) {
    e.stopPropagation()
    setIsResizing(true); isResizingRef.current = true
    resizeRef.current = { corner, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.width, origH: el.height }
    resizeSnapRef.current = elements
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  // ── Image upload ──────────────────────────────────────────────────
  async function handleImageFile(file: File) {
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) { toast.error('이미지 업로드 실패'); return }
    const { url } = await res.json()
    const rect = wrapperRef.current!.getBoundingClientRect()
    const pos = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
    addElement({ id: nanoid(), type: 'IMAGE', x: pos.x - 150, y: pos.y - 100, width: 300, height: 200, content: url, style: {}, zIndex: zIndexCounter.current++ })
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (file) handleImageFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pan, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (file) await handleImageFile(file); e.target.value = ''
  }

  // ── Derived ───────────────────────────────────────────────────────
  const sortedElements = useMemo(() => elements.slice().sort((a, b) => a.zIndex - b.zIndex), [elements])
  const singleEl = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) : undefined
  const multiBounds = useMemo(() => {
    if (selectedIds.length < 2) return null
    const sel = elements.filter((el) => selectedIds.includes(el.id)); if (!sel.length) return null
    return { x: Math.min(...sel.map(e => e.x)), y: Math.min(...sel.map(e => e.y)), right: Math.max(...sel.map(e => e.x + e.width)), bottom: Math.max(...sel.map(e => e.y + e.height)) }
  }, [elements, selectedIds])
  const presenceOthers = useMemo(() => Object.values(presence).filter((u) => u.userId !== session?.user?.id), [presence, session?.user?.id])

  // Stable callbacks for CanvasElement to prevent re-renders
  // "Ref pattern": update ref every render so useCallback([], []) always reads fresh functions
  const handlersRef = useRef({ onElementPointerDown, onResizePointerDown, updateElement })
  handlersRef.current = { onElementPointerDown, onResizePointerDown, updateElement }

  const handlePointerDown    = useCallback((e: React.PointerEvent, el: BoardElement) => handlersRef.current.onElementPointerDown(e, el), []) // eslint-disable-line react-hooks/exhaustive-deps
  const handleResizeDown     = useCallback((e: React.PointerEvent, el: BoardElement, c: string) => handlersRef.current.onResizePointerDown(e, el, c), []) // eslint-disable-line react-hooks/exhaustive-deps
  const handleContentChange  = useCallback((id: string, v: string) => handlersRef.current.updateElement(id, { content: v }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const handleEditEnd = useCallback(() => setEditingId(null), [])

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background" style={{ top: 0 }}>
      <p className="text-text-secondary text-sm animate-pulse">보드 불러오는 중...</p>
    </div>
  )
  if (!board) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background" style={{ top: 0 }}>
      <div className="text-center">
        <p className="text-text-primary font-semibold mb-2">보드를 찾을 수 없습니다</p>
        <button onClick={() => router.push('/boards')} className="text-accent text-sm hover:underline">← 보드 목록</button>
      </div>
    </div>
  )

  const cursor = isPanning ? 'cursor-grabbing' : spaceHeld.current ? 'cursor-grab'
    : tool === 'pen' ? 'cursor-crosshair' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden" style={{ top: 0, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
      onContextMenu={(e) => e.preventDefault()}>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between h-12 px-4 bg-surface border-b border-border shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (isDirty.current) save(elements); router.push('/boards') }}
            className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm transition-colors">
            <ArrowLeft size={15} /> 보드 목록
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-text-primary font-semibold text-sm">{board.name}</span>
            {board.isPublic ? <Globe size={12} className="text-muted" /> : <Lock size={12} className="text-muted" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => save(elements)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors">
            <Save size={13} /> 저장
          </button>
          <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg px-1 border border-border">
            <button onClick={() => zoomTo(zoom / 1.2)} className="p-1.5 text-text-secondary hover:text-text-primary"><Minus size={13} /></button>
            <button onClick={resetView} className="text-xs text-text-secondary hover:text-text-primary w-12 text-center">{Math.round(zoom * 100)}%</button>
            <button onClick={() => zoomTo(zoom * 1.2)} className="p-1.5 text-text-secondary hover:text-text-primary"><Plus size={13} /></button>
          </div>
        </div>
      </div>

      {/* ── Right Presence Panel ── */}
      <div className="fixed right-4 top-16 z-30 w-44 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">참여자</span>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-gray-400 animate-pulse'}`} />
            <span className="text-[10px] text-muted">{presenceOthers.length + 1}명</span>
          </div>
        </div>

        {/* 내 아바타 */}
        {session?.user && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
            <div className="relative shrink-0">
              <div className="w-7 h-7 rounded-full border-2 overflow-hidden" style={{ borderColor: '#3b82f6' }}>
                <Avatar name={session.user.name} image={session.user.image} size={28} />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${sseConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{session.user.name}</p>
              <p className="text-[10px] text-muted">나</p>
            </div>
          </div>
        )}

        {/* 다른 참여자들 */}
        {presenceOthers.length === 0 ? (
          <div className="px-3 py-3 text-[11px] text-muted text-center">혼자 사용 중</div>
        ) : (
          <div className="py-1">
            {presenceOthers.map((u) => (
              <button key={u.userId}
                onClick={() => setFollowingId(followingId === u.userId ? null : u.userId)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 transition-colors text-left ${followingId === u.userId ? 'bg-accent/10' : ''}`}>
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-full border-2 overflow-hidden" style={{ borderColor: u.color }}>
                    <Avatar name={u.name} image={u.image} size={28} />
                  </div>
                  {followingId === u.userId && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-surface" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary truncate">{u.name}</p>
                  <p className="text-[10px] text-muted">{followingId === u.userId ? '👁 팔로잉 중' : '클릭해서 따라가기'}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 팔로우 해제 버튼 */}
        {followingId && (
          <div className="px-2 pb-2">
            <button onClick={() => setFollowingId(null)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-xs font-semibold hover:bg-green-500/20 transition-colors border border-green-500/20">
              <X size={11} /> 팔로우 해제
            </button>
          </div>
        )}
      </div>

      {/* ── Left Toolbar ── */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 bg-surface border border-border rounded-xl p-1.5 shadow-lg">
        {([
          { t: 'select' as Tool, Icon: MousePointer2, label: '선택 (V)' },
          { t: 'pen'    as Tool, Icon: Pen,           label: '그리기 (P)' },
          { t: 'text'   as Tool, Icon: Type,          label: '텍스트 (T)' },
          { t: 'sticky' as Tool, Icon: StickyNote,    label: '스티커 (S)' },
          { t: 'image'  as Tool, Icon: ImageIcon,     label: '이미지 (I)' },
        ] as const).map(({ t, Icon, label }) => (
          <button key={t} title={label}
            onClick={() => { setTool(t); setShowShapeMenu(false); if (t === 'image') fileInputRef.current?.click() }}
            className={`p-2.5 rounded-lg transition-colors ${tool === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'}`}>
            <Icon size={18} />
          </button>
        ))}

        {/* Shape tool with sub-menu */}
        <div className="relative">
          <button title="도형 (R)"
            onClick={() => { setTool('shape'); setShowShapeMenu(!showShapeMenu) }}
            className={`p-2.5 rounded-lg transition-colors w-full flex items-center justify-center ${tool === 'shape' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'}`}>
            <Shapes size={18} />
          </button>
          {showShapeMenu && (
            <div className="absolute left-full top-0 ml-2 bg-surface border border-border rounded-xl p-2 shadow-xl grid grid-cols-2 gap-1 w-40">
              {SHAPES.map(({ type: st, label }) => (
                <button key={st} onClick={() => { setShapeType(st); setShowShapeMenu(false) }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${shapeType === st && tool === 'shape' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pen color & width */}
        {tool === 'pen' && (
          <>
            <div className="w-full h-px bg-border my-0.5" />
            {PEN_COLORS.map((c) => (
              <button key={c} onClick={() => setPenColor(c)} className="p-1 rounded-lg flex items-center justify-center"
                style={{ background: penColor === c ? 'var(--color-surface-2)' : 'transparent' }}>
                <div className="w-4 h-4 rounded-full border-2 transition-transform"
                  style={{ background: c, borderColor: penColor === c ? 'var(--color-accent-dim)' : 'transparent', transform: penColor === c ? 'scale(1.2)' : 'scale(1)' }} />
              </button>
            ))}
            <div className="w-full h-px bg-border my-0.5" />
            {/* Pen width presets */}
            {[1, 2, 4, 8].map((w) => (
              <button key={w} onClick={() => setPenWidth(w)}
                className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${penWidth === w ? 'bg-accent/20' : 'hover:bg-surface-2'}`}>
                <div className="rounded-full bg-text-primary transition-all" style={{ width: w + 4, height: w + 4 }} />
              </button>
            ))}
          </>
        )}

        <div className="w-full h-px bg-border my-0.5" />
        <button title="화면 초기화" onClick={resetView} className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><Maximize2 size={18} /></button>
        <button onClick={() => zoomTo(zoom * 1.2)} className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><ZoomIn size={18} /></button>
        <button onClick={() => zoomTo(zoom / 1.2)} className="p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><ZoomOut size={18} /></button>
      </div>

      {/* ── Single-element bottom toolbar ── */}
      {singleEl && !editingId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 flex-wrap bg-surface border border-border rounded-xl px-3 py-2 shadow-xl max-w-[92vw] justify-center">
          {(singleEl.type === 'TEXT' || singleEl.type === 'STICKY') && (
            <button onClick={() => setEditingId(singleEl.id)} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><Pencil size={15} /></button>
          )}
          {singleEl.type === 'TEXT' && (
            <div className="flex items-center gap-1 border-r border-border pr-2">
              {TEXT_COLORS.map((c) => (
                <button key={c} onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, color: c } })}
                  className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
                  style={{ background: c, borderColor: singleEl.style.color === c ? 'rgb(var(--color-accent))' : 'transparent', outline: c === '#f9fafb' ? '1px solid var(--color-border-2)' : undefined }} />
              ))}
            </div>
          )}
          {(singleEl.type === 'TEXT' || singleEl.type === 'STICKY') && (
            <div className="flex items-center gap-0.5 border-r border-border pr-2">
              <button onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, fontSize: Math.max(8, (singleEl.style.fontSize ?? 14) - 2) } })}
                className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><Minus size={12} /></button>
              <span className="text-xs text-text-secondary w-6 text-center">{singleEl.style.fontSize ?? 14}</span>
              <button onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, fontSize: Math.min(72, (singleEl.style.fontSize ?? 14) + 2) } })}
                className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><Plus size={12} /></button>
            </div>
          )}
          {singleEl.type === 'TEXT' && (
            <button onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, textAlign: singleEl.style.textAlign === 'center' ? 'left' : 'center' } })}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors border-r border-border pr-2 mr-0.5"><AlignLeft size={15} /></button>
          )}
          {singleEl.type === 'STICKY' && (
            <div className="flex items-center gap-1 border-r border-border pr-2">
              {STICKY_COLORS.map((c) => (
                <button key={c} onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, bgColor: c } })}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${singleEl.style.bgColor === c ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c }} />
              ))}
            </div>
          )}
          {singleEl.type === 'SHAPE' && (
            <>
              <div className="flex items-center gap-1 border-r border-border pr-2">
                {SHAPE_COLORS.map((c) => (
                  <button key={c} onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, bgColor: c } })}
                    className={`w-5 h-5 rounded border-2 transition-all ${singleEl.style.bgColor === c ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-1 border-r border-border pr-2">
                {SHAPES.map(({ type: st, label }) => (
                  <button key={st} onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, shapeType: st } })}
                    className={`px-2 py-1 rounded text-xs transition-colors ${singleEl.style.shapeType === st ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-2'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {singleEl.type === 'PEN' && (
            <>
              <div className="flex items-center gap-1 border-r border-border pr-2">
                {PEN_COLORS.map((c) => (
                  <button key={c} onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, strokeColor: c } })}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${singleEl.style.strokeColor === c ? 'border-accent scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-1 border-r border-border pr-2">
                {[1, 2, 4, 8].map((w) => (
                  <button key={w} onClick={() => updateElement(singleEl.id, { style: { ...singleEl.style, strokeWidth: w } })}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${singleEl.style.strokeWidth === w ? 'bg-accent/20' : 'hover:bg-surface-2'}`}>
                    <div className="rounded-full bg-text-primary" style={{ width: w + 2, height: w + 2 }} />
                  </button>
                ))}
              </div>
            </>
          )}
          <button title="맨 앞으로" onClick={() => bringToFront(selectedIds)} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 text-xs font-bold">↑</button>
          <button onClick={() => deleteElements(selectedIds)} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={15} /></button>
          <button onClick={() => { setSelectedIds([]); setEditingId(null) }} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><X size={15} /></button>
        </div>
      )}

      {/* ── Multi-select toolbar ── */}
      {selectedIds.length > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 shadow-xl">
          <span className="text-sm font-semibold text-text-primary">{selectedIds.length}개 선택됨</span>
          <div className="w-px h-4 bg-border" />
          <button onClick={() => bringToFront(selectedIds)} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 text-xs font-bold">↑</button>
          <button onClick={() => deleteElements(selectedIds)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 text-sm">
            <Trash2 size={14} /> 모두 삭제
          </button>
          <button onClick={() => setSelectedIds([])} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"><X size={15} /></button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div ref={wrapperRef}
        className={`flex-1 relative overflow-hidden select-none ${cursor} bg-surface-2`}
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none', // iOS 손바닥 터치 시 복사/붙여넣기 팝업 방지
          userSelect: 'none',
        } as React.CSSProperties}
        onContextMenu={(e) => e.preventDefault()}  // 길게 눌러도 컨텍스트 메뉴 안 뜸
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onWheel={handleWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>

        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.5 }}>
          <defs>
            <pattern id="dots" x={(pan.x % (GRID_SIZE * zoom)).toFixed(1)} y={(pan.y % (GRID_SIZE * zoom)).toFixed(1)}
              width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill="var(--color-border-2)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Rubber-band selection */}
        {selRect && (
          <div style={{
            position: 'absolute',
            left: Math.min(selRect.x1, selRect.x2) * zoom + pan.x,
            top:  Math.min(selRect.y1, selRect.y2) * zoom + pan.y,
            width: Math.abs(selRect.x2 - selRect.x1) * zoom,
            height: Math.abs(selRect.y2 - selRect.y1) * zoom,
            border: '1.5px dashed rgb(var(--color-accent))',
            background: 'rgb(var(--color-accent) / 0.06)',
            borderRadius: 3, pointerEvents: 'none', zIndex: 20,
          }} />
        )}

        {/* Remote cursors (screen-space overlay) */}
        {Object.entries(remoteCursors).map(([uid, c]) => {
          const sx = c.cursorX * zoom + pan.x
          const sy = c.cursorY * zoom + pan.y
          return (
            <div key={uid} style={{ position: 'absolute', left: sx, top: sy, pointerEvents: 'none', zIndex: 50, transform: 'translate(0, 0)' }}>
              <svg width={16} height={16} style={{ display: 'block' }}>
                <path d="M 0 0 L 0 12 L 3.5 9 L 6 14 L 8 13 L 5.5 8 L 10 8 Z" fill={c.color} stroke="white" strokeWidth="0.8" />
              </svg>
              <span style={{ background: c.color, color: 'white', fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap', display: 'block', marginTop: 1 }}>
                {c.name}
              </span>
            </div>
          )
        })}

        {/* Transform container */}
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0 }}>
          {/* Live pen stroke */}
          <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <path ref={livePathRef} stroke={penColor} strokeWidth={penWidth / zoom} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Multi-select bounding box */}
          {multiBounds && (
            <div style={{ position: 'absolute', left: multiBounds.x - 6, top: multiBounds.y - 6, width: multiBounds.right - multiBounds.x + 12, height: multiBounds.bottom - multiBounds.y + 12, border: '1.5px dashed rgb(var(--color-accent))', borderRadius: 4, pointerEvents: 'none' }} />
          )}

          {/* Elements */}
          {sortedElements.map((el) => (
            <CanvasElement key={el.id} el={el}
              isSelected={selectedIds.includes(el.id)} isEditing={editingId === el.id}
              onPointerDown={(e) => handlePointerDown(e, el)}
              onResizePointerDown={(e, c) => handleResizeDown(e, el, c)}
              onDoubleClick={() => { if (el.type === 'TEXT' || el.type === 'STICKY') { setSelectedIds([el.id]); setEditingId(el.id) } }}
              onContentChange={(v) => handleContentChange(el.id, v)}
              onEditEnd={handleEditEnd} />
          ))}
        </div>

        {elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted space-y-2">
              <p className="text-xl font-bold">빈 보드</p>
              <p className="text-sm">왼쪽 툴바에서 도구를 선택하거나 이미지를 붙여넣으세요</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs opacity-60 mt-1">
                <span>V 선택 · P 연필 · T 텍스트</span>
                <span>S 스티커 · R 도형 · I 이미지</span>
                <span>Ctrl+Z 실행취소 · Ctrl+C/V 복사</span>
                <span>Space+드래그 · 두 손가락 이동</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  )
}

// ─── Shape renderer helper ────────────────────────────────────────
function renderShape(shapeType: ShapeType | undefined, bg: string, w: number, h: number): React.CSSProperties {
  const base: React.CSSProperties = { width: '100%', height: '100%', background: bg }
  switch (shapeType) {
    case 'circle':      return { ...base, borderRadius: '50%' }
    case 'triangle':    return { ...base, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', background: bg }
    case 'diamond':     return { ...base, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }
    case 'star':        return { ...base, clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }
    case 'arrow-right': return { ...base, clipPath: 'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)' }
    case 'hexagon':     return { ...base, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }
    case 'speech': {
      // Rendered as SVG path
      return {}
    }
    default:            return { ...base, borderRadius: 8 }
  }
}

// ─── Canvas Element ────────────────────────────────────────────────
interface CEProps {
  el: BoardElement; isSelected: boolean; isEditing: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onResizePointerDown: (e: React.PointerEvent, corner: string) => void
  onDoubleClick: () => void; onContentChange: (v: string) => void; onEditEnd: () => void
}

const CanvasElement = memo(function CanvasElement({ el, isSelected, isEditing, onPointerDown, onResizePointerDown, onDoubleClick, onContentChange, onEditEnd }: CEProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (isEditing && textRef.current) { textRef.current.focus(); textRef.current.select() } }, [isEditing])

  const base: React.CSSProperties = { position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height, cursor: isEditing ? 'text' : 'move', userSelect: 'none', touchAction: 'none' }
  const ring = isSelected ? '0 0 0 2px rgb(var(--color-accent))' : undefined

  if (el.type === 'TEXT') return (
    <div style={base} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      {isEditing ? (
        <textarea ref={textRef} value={el.content} onChange={(e) => onContentChange(e.target.value)}
          onBlur={onEditEnd} onKeyDown={(e) => { if (e.key === 'Escape') onEditEnd() }}
          style={{ width: '100%', height: '100%', background: 'transparent', border: '1px solid rgb(var(--color-accent))', borderRadius: 4, outline: 'none', color: el.style.color ?? 'var(--color-text-primary)', fontSize: el.style.fontSize ?? 16, resize: 'none', padding: '4px 8px', lineHeight: 1.5 }} />
      ) : (
        <div style={{ width: '100%', height: '100%', padding: '4px 8px', color: el.style.color ?? 'var(--color-text-primary)', fontSize: el.style.fontSize ?? 16, textAlign: (el.style.textAlign as React.CSSProperties['textAlign']) ?? 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, boxShadow: ring, borderRadius: 4 }}>
          {el.content}
        </div>
      )}
      {isSelected && !isEditing && <ResizeHandles el={el} on={onResizePointerDown} />}
    </div>
  )

  if (el.type === 'STICKY') {
    const bg = el.style.bgColor ?? '#fef08a'
    return (
      <div style={{ ...base, boxShadow: isSelected ? ring : '2px 4px 12px rgba(0,0,0,0.12)' }} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
        <div style={{ width: '100%', height: '100%', background: bg, borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 22, background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4 }}>
            {[0.3, 0.2, 0.12].map((a, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: `rgba(0,0,0,${a})` }} />)}
          </div>
          {isEditing ? (
            <textarea ref={textRef} value={el.content} onChange={(e) => onContentChange(e.target.value)}
              onBlur={onEditEnd} onKeyDown={(e) => { if (e.key === 'Escape') onEditEnd() }}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', padding: '8px', fontSize: el.style.fontSize ?? 14, color: '#1a1a1a', lineHeight: 1.6 }} />
          ) : (
            <div style={{ flex: 1, padding: '8px', fontSize: el.style.fontSize ?? 14, color: '#1a1a1a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, overflow: 'hidden' }}>{el.content}</div>
          )}
        </div>
        {isSelected && !isEditing && <ResizeHandles el={el} on={onResizePointerDown} />}
      </div>
    )
  }

  if (el.type === 'IMAGE') return (
    <div style={{ ...base, boxShadow: ring }} onPointerDown={onPointerDown}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={el.content} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6, display: 'block', pointerEvents: 'none' }} />
      {isSelected && <ResizeHandles el={el} on={onResizePointerDown} />}
    </div>
  )

  if (el.type === 'SHAPE') {
    const bg = el.style.bgColor ?? '#3b82f6'
    const st = el.style.shapeType ?? 'rect'
    // Speech bubble needs SVG
    if (st === 'speech') return (
      <div style={{ ...base, boxShadow: ring }} onPointerDown={onPointerDown}>
        <svg width={el.width} height={el.height} style={{ display: 'block', pointerEvents: 'none', overflow: 'visible' }}>
          <path d={`M 10 0 Q 0 0 0 10 L 0 ${el.height * 0.75} Q 0 ${el.height * 0.85} 10 ${el.height * 0.85} L ${el.width * 0.2} ${el.height * 0.85} L ${el.width * 0.15} ${el.height} L ${el.width * 0.35} ${el.height * 0.85} Q ${el.width - 10} ${el.height * 0.85} ${el.width - 10} ${el.height * 0.75} L ${el.width - 10} 10 Q ${el.width - 10} 0 ${el.width - 20} 0 Z`}
            fill={bg} />
        </svg>
        {isSelected && <ResizeHandles el={el} on={onResizePointerDown} />}
      </div>
    )
    return (
      <div style={{ ...base, boxShadow: ring }} onPointerDown={onPointerDown}>
        <div style={renderShape(st, bg, el.width, el.height)} />
        {isSelected && <ResizeHandles el={el} on={onResizePointerDown} />}
      </div>
    )
  }

  if (el.type === 'PEN') return (
    <div style={{ ...base, boxShadow: ring }} onPointerDown={onPointerDown}>
      <svg width={el.width} height={el.height} style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
        <path d={el.content} stroke={el.style.strokeColor ?? '#374151'} strokeWidth={el.style.strokeWidth ?? 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {isSelected && <ResizeHandles el={el} on={onResizePointerDown} minimal />}
    </div>
  )

  return null
})

// ─── Resize Handles ───────────────────────────────────────────────
function ResizeHandles({ el, on, minimal }: { el: BoardElement; on: (e: React.PointerEvent, c: string) => void; minimal?: boolean }) {
  const corners = minimal ? ['e', 'w'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const pos: Record<string, React.CSSProperties> = {
    nw: { top: -4, left: -4 }, n: { top: -4, left: '50%', transform: 'translateX(-50%)' },
    ne: { top: -4, right: -4 }, e: { top: '50%', right: -4, transform: 'translateY(-50%)' },
    se: { bottom: -4, right: -4 }, s: { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
    sw: { bottom: -4, left: -4 }, w: { top: '50%', left: -4, transform: 'translateY(-50%)' },
  }
  const cur: Record<string, string> = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize' }
  return (
    <>
      {corners.map((c) => (
        <div key={c} onPointerDown={(e) => { e.stopPropagation(); on(e, c) }}
          style={{ position: 'absolute', width: 8, height: 8, background: 'var(--color-bg)', border: '2px solid rgb(var(--color-accent))', borderRadius: 2, cursor: cur[c], touchAction: 'none', zIndex: 10, ...pos[c] }} />
      ))}
    </>
  )
}

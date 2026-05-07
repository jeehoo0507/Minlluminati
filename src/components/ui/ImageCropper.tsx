'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'
interface Rect { x: number; y: number; w: number; h: number }

interface ImageCropperProps {
  imageSrc: string
  /** Initial aspect ratio (null = free). e.g. 16/9 */
  defaultAspect?: number | null
  /** Output image width in pixels (height auto-computed) */
  outputWidth?: number
  /** Title shown in the header */
  title?: string
  onCrop: (dataUrl: string) => void
  onCancel: () => void
}

const MIN_SIZE = 30

const ASPECT_PRESETS: { label: string; value: number | null }[] = [
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '4:1', value: 4 },
  { label: '1:1', value: 1 },
  { label: '자유', value: null },
]

const HANDLE_DEFS: { id: Handle; style: React.CSSProperties; cursor: string }[] = [
  { id: 'nw', style: { top: -5, left: -5 },                              cursor: 'nw-resize' },
  { id: 'n',  style: { top: -5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'n-resize'  },
  { id: 'ne', style: { top: -5, right: -5 },                             cursor: 'ne-resize' },
  { id: 'e',  style: { top: '50%', right: -5, transform: 'translateY(-50%)' }, cursor: 'e-resize'  },
  { id: 'se', style: { bottom: -5, right: -5 },                          cursor: 'se-resize' },
  { id: 's',  style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' }, cursor: 's-resize'  },
  { id: 'sw', style: { bottom: -5, left: -5 },                           cursor: 'sw-resize' },
  { id: 'w',  style: { top: '50%', left: -5, transform: 'translateY(-50%)' }, cursor: 'w-resize'  },
]

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi) }

// ── Component ──────────────────────────────────────────────────────────────────
export function ImageCropper({
  imageSrc,
  defaultAspect = 16 / 9,
  outputWidth = 1200,
  title = '배너 영역 선택',
  onCrop,
  onCancel,
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef       = useRef<HTMLImageElement>(null)

  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgDisp,   setImgDisp]   = useState({ w: 0, h: 0 })
  const [crop,      setCrop]      = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const [aspect,    setAspect]    = useState<number | null>(defaultAspect)

  // Interaction state (mutable refs — no re-render on every pixel)
  const activeHandle  = useRef<Handle | null>(null)
  const startMouse    = useRef({ x: 0, y: 0 })
  const startCrop     = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const aspectRef     = useRef<number | null>(defaultAspect)

  // Keep aspectRef in sync with state
  useEffect(() => { aspectRef.current = aspect }, [aspect])

  // ── Init crop from image size + aspect ─────────────────────────────────────
  function initCrop(dw: number, dh: number, asp: number | null) {
    let cw: number, ch: number
    if (asp) {
      cw = dw; ch = cw / asp
      if (ch > dh) { ch = dh; cw = ch * asp }
    } else {
      cw = dw * 0.82; ch = dh * 0.82
    }
    cw = Math.max(cw, MIN_SIZE); ch = Math.max(ch, MIN_SIZE)
    setCrop({ x: (dw - cw) / 2, y: (dh - ch) / 2, w: cw, h: ch })
  }

  function onImgLoad() {
    const img  = imgRef.current!
    const rect = img.getBoundingClientRect()
    const dw = rect.width, dh = rect.height
    setImgDisp({ w: dw, h: dh })
    initCrop(dw, dh, aspectRef.current)
    setImgLoaded(true)
  }

  function changeAspect(a: number | null) {
    setAspect(a)
    aspectRef.current = a
    if (imgDisp.w > 0) initCrop(imgDisp.w, imgDisp.h, a)
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  function onHandleMouseDown(e: React.MouseEvent, handle: Handle) {
    e.preventDefault(); e.stopPropagation()
    activeHandle.current = handle
    startMouse.current   = { x: e.clientX, y: e.clientY }
    startCrop.current    = { ...crop }
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!activeHandle.current) return
    const handle = activeHandle.current
    const dx = e.clientX - startMouse.current.x
    const dy = e.clientY - startMouse.current.y
    const { x: ox, y: oy, w: ow, h: oh } = startCrop.current
    const iw = imgDisp.w, ih = imgDisp.h
    const asp = aspectRef.current

    setCrop(() => {
      let nx = ox, ny = oy, nw = ow, nh = oh

      if (handle === 'move') {
        nx = clamp(ox + dx, 0, iw - ow)
        ny = clamp(oy + dy, 0, ih - oh)
        return { x: nx, y: ny, w: nw, h: nh }
      }

      // ── Compute unconstrained resize ────────────────────────────────────
      const moveN = handle.includes('n')
      const moveS = handle.includes('s')
      const moveW = handle.includes('w')
      const moveE = handle.includes('e')

      if (moveE) nw = clamp(ow + dx, MIN_SIZE, iw - ox)
      if (moveS) nh = clamp(oh + dy, MIN_SIZE, ih - oy)
      if (moveW) {
        const maxShift = ow - MIN_SIZE
        const shift    = clamp(dx, -ox, maxShift)
        nx = ox + shift; nw = ow - shift
      }
      if (moveN) {
        const maxShift = oh - MIN_SIZE
        const shift    = clamp(dy, -oy, maxShift)
        ny = oy + shift; nh = oh - shift
      }

      // ── Apply aspect lock ───────────────────────────────────────────────
      if (asp) {
        const isCorner = (moveN || moveS) && (moveW || moveE)
        if (isCorner) {
          // Use the dominant delta to decide size
          const useW = Math.abs(dx) * (1 / asp) >= Math.abs(dy)
          if (useW) {
            nh = nw / asp
            // Recompute y-edge from the new height
            if (moveN) { ny = oy + oh - nh }
          } else {
            nw = nh * asp
            // Recompute x-edge from new width
            if (moveW) { nx = ox + ow - nw }
          }
        } else if (moveW || moveE) {
          // Horizontal resize → adjust height
          nh = nw / asp
          if (moveN) ny = oy + oh - nh
        } else {
          // Vertical resize → adjust width
          nw = nh * asp
          if (moveW) nx = ox + ow - nw
        }
      }

      // ── Clamp to image bounds ───────────────────────────────────────────
      if (nx < 0)       { if (moveW) nw += nx; nx = 0 }
      if (ny < 0)       { if (moveN) nh += ny; ny = 0 }
      if (nx + nw > iw) nw = iw - nx
      if (ny + nh > ih) nh = ih - ny
      nw = Math.max(nw, MIN_SIZE); nh = Math.max(nh, MIN_SIZE)

      return { x: nx, y: ny, w: nw, h: nh }
    })
  }, [imgDisp])

  const onMouseUp = useCallback(() => { activeHandle.current = null }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  // ── Touch support ──────────────────────────────────────────────────────────
  function onHandleTouchStart(e: React.TouchEvent, handle: Handle) {
    if (e.touches.length !== 1) return
    e.stopPropagation()
    const t = e.touches[0]
    activeHandle.current = handle
    startMouse.current   = { x: t.clientX, y: t.clientY }
    startCrop.current    = { ...crop }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!activeHandle.current || e.touches.length !== 1) return
    e.preventDefault()
    const synth = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as MouseEvent
    onMouseMove(synth)
  }

  // ── Confirm crop ──────────────────────────────────────────────────────────
  function handleConfirm() {
    const img = imgRef.current!
    const sx  = img.naturalWidth  / imgDisp.w
    const sy  = img.naturalHeight / imgDisp.h
    const outW = outputWidth
    const outH = Math.max(1, Math.round(outW * (crop.h / crop.w)))
    const canvas = document.createElement('canvas')
    canvas.width = outW; canvas.height = outH
    canvas.getContext('2d')!.drawImage(
      img,
      crop.x * sx, crop.y * sy, crop.w * sx, crop.h * sy,
      0, 0, outW, outH,
    )
    onCrop(canvas.toDataURL('image/jpeg', 0.92))
  }

  // ── Real pixel dimensions ─────────────────────────────────────────────────
  const img = imgRef.current
  const pxW = img && imgDisp.w ? Math.round(crop.w * img.naturalWidth  / imgDisp.w) : 0
  const pxH = img && imgDisp.h ? Math.round(crop.h * img.naturalHeight / imgDisp.h) : 0

  // ── Width slider (as % of display width) ─────────────────────────────────
  const cropPct = imgDisp.w > 0 ? Math.round((crop.w / imgDisp.w) * 100) : 100
  function onSliderChange(pct: number) {
    if (imgDisp.w === 0) return
    const newW = clamp((pct / 100) * imgDisp.w, MIN_SIZE, imgDisp.w)
    const newH = aspect ? newW / aspect : clamp((pct / 100) * imgDisp.h, MIN_SIZE, imgDisp.h)
    const newX = clamp((imgDisp.w - newW) / 2, 0, imgDisp.w - newW)
    const newY = clamp((imgDisp.h - newH) / 2, 0, imgDisp.h - newH)
    setCrop({ x: newX, y: newY, w: newW, h: newH })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
      <div className="bg-surface rounded-2xl p-4 w-full max-w-2xl space-y-3 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {imgLoaded && (
            <p className="text-xs text-muted tabular-nums">
              {pxW} × {pxH} px
            </p>
          )}
        </div>

        {/* Aspect ratio presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-text-secondary">비율</span>
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => changeAspect(p.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                aspect === p.value
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-border-2'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Width slider */}
        {imgLoaded && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-12 shrink-0">너비 {cropPct}%</span>
            <input
              type="range" min={20} max={100} value={cropPct}
              onChange={(e) => onSliderChange(Number(e.target.value))}
              className="flex-1 h-1.5 accent-accent cursor-pointer"
            />
          </div>
        )}

        {/* Image + crop overlay */}
        <div
          ref={containerRef}
          className="relative select-none overflow-hidden rounded-lg bg-black/20"
          onTouchMove={onTouchMove}
          onTouchEnd={() => { activeHandle.current = null }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            className="w-full block max-h-[55vh] object-contain"
            onLoad={onImgLoad}
            draggable={false}
          />

          {imgLoaded && (
            <>
              {/* Dark mask outside crop */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bg-black/60" style={{ top: 0,          left: 0,       right: 0,      height: crop.y }} />
                <div className="absolute bg-black/60" style={{ top: crop.y + crop.h, left: 0, right: 0,      bottom: 0 }} />
                <div className="absolute bg-black/60" style={{ top: crop.y,     left: 0,       width: crop.x, height: crop.h }} />
                <div className="absolute bg-black/60" style={{ top: crop.y,     left: crop.x + crop.w, right: 0, height: crop.h }} />
              </div>

              {/* Crop box */}
              <div
                className="absolute border-2 border-white"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, cursor: 'move', touchAction: 'none' }}
                onMouseDown={(e) => onHandleMouseDown(e, 'move')}
                onTouchStart={(e) => onHandleTouchStart(e, 'move')}
              >
                {/* Rule-of-thirds grid */}
                <div className="absolute inset-0 pointer-events-none">
                  {['33.33%', '66.66%'].map((pos) => (
                    <div key={`h-${pos}`} className="absolute border-t border-white/30" style={{ top: pos, left: 0, right: 0 }} />
                  ))}
                  {['33.33%', '66.66%'].map((pos) => (
                    <div key={`v-${pos}`} className="absolute border-l border-white/30" style={{ left: pos, top: 0, bottom: 0 }} />
                  ))}
                </div>

                {/* 8 resize handles */}
                {HANDLE_DEFS.map(({ id, style, cursor }) => (
                  <div
                    key={id}
                    className="absolute w-3 h-3 bg-white rounded-sm shadow-md border border-black/10"
                    style={{ ...style, position: 'absolute', cursor, touchAction: 'none' }}
                    onMouseDown={(e) => onHandleMouseDown(e, id)}
                    onTouchStart={(e) => onHandleTouchStart(e, id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-muted">
          가운데 드래그 → 이동 &nbsp;·&nbsp; 모서리/가장자리 드래그 → 크기 조정 &nbsp;·&nbsp; 슬라이더 → 너비 조정
        </p>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!imgLoaded}
            className="px-5 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 font-medium"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}

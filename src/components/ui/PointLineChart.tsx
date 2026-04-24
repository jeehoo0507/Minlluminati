'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DataPoint { date: string; points: number }
interface Props {
  data: DataPoint[]
  year: number
  onYearChange: (y: number) => void
}

export function PointLineChart({ data, year, onYearChange }: Props) {
  const currentYear = new Date().getFullYear()

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <YearNav year={year} currentYear={currentYear} onYearChange={onYearChange} />
        <div className="h-32 flex items-center justify-center text-xs text-muted">이 연도에 포인트 기록이 없습니다</div>
      </div>
    )
  }

  const W = 520
  const H = 130
  const PAD = { top: 12, right: 12, bottom: 28, left: 44 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const minPt = Math.min(...data.map((d) => d.points))
  const maxPt = Math.max(...data.map((d) => d.points), minPt + 1)
  const range = maxPt - minPt || 1

  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW
  const toY = (v: number) => PAD.top + innerH - ((v - minPt) / range) * innerH

  const polyPoints = data.map((d, i) => `${toX(i)},${toY(d.points)}`).join(' ')
  const areaPoints = `${toX(0)},${PAD.top + innerH} ${polyPoints} ${toX(data.length - 1)},${PAD.top + innerH}`

  // Y ticks
  const yTicks = [minPt, Math.round((minPt + maxPt) / 2), maxPt]

  // X labels: show one per month
  const monthLabels: { x: number; label: string }[] = []
  let lastMonth = ''
  data.forEach((d, i) => {
    const m = d.date.slice(5, 7)
    if (m !== lastMonth) {
      monthLabels.push({ x: toX(i), label: m + '월' })
      lastMonth = m
    }
  })

  return (
    <div className="space-y-2">
      <YearNav year={year} currentYear={currentYear} onYearChange={onYearChange} maxPt={maxPt} />
      <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 260 }}>
          <defs>
            <linearGradient id="ptGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(37 99 235)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(37 99 235)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {yTicks.map((v) => {
            const y = toY(v)
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.45}>
                  {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                </text>
              </g>
            )
          })}

          {/* Area */}
          <polygon points={areaPoints} fill="url(#ptGrad)" />

          {/* Line */}
          <polyline points={polyPoints} fill="none" stroke="rgb(37 99 235)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Last point dot */}
          <circle
            cx={toX(data.length - 1)}
            cy={toY(data[data.length - 1].points)}
            r={3.5}
            fill="rgb(37 99 235)"
          />

          {/* X month labels */}
          {monthLabels.map(({ x, label }) => (
            <text key={label} x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.45}>
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

function YearNav({ year, currentYear, onYearChange, maxPt }: { year: number; currentYear: number; onYearChange: (y: number) => void; maxPt?: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted">
      <div className="flex items-center gap-2">
        <button onClick={() => onYearChange(year - 1)} className="p-0.5 rounded hover:text-text-primary transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="font-semibold text-text-secondary">{year}년</span>
        <button onClick={() => onYearChange(year + 1)} disabled={year >= currentYear} className="p-0.5 rounded hover:text-text-primary transition-colors disabled:opacity-30">
          <ChevronRight size={14} />
        </button>
      </div>
      {maxPt !== undefined && <span>{maxPt.toLocaleString()}pt 달성</span>}
    </div>
  )
}

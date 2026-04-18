'use client'

interface DataPoint { month: string; points: number }

interface Props { data: DataPoint[] }

export function PointLineChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-xs text-muted">아직 포인트 데이터가 없습니다</div>
  }

  const W = 520
  const H = 120
  const PAD = { top: 10, right: 10, bottom: 28, left: 40 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxPt = Math.max(...data.map((d) => d.points), 10)

  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * innerW
  const toY = (v: number) => PAD.top + innerH - (v / maxPt) * innerH

  const points = data.map((d, i) => `${toX(i)},${toY(d.points)}`).join(' ')
  const areaPoints = `${toX(0)},${PAD.top + innerH} ${points} ${toX(data.length - 1)},${PAD.top + innerH}`

  // Y-axis ticks
  const yTicks = [0, Math.round(maxPt / 2), maxPt]

  // X-axis: show every N months
  const step = Math.ceil(data.length / 6)
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 300 }}>
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
              stroke="currentColor" strokeOpacity={0.1} strokeWidth={1}
            />
            <text x={PAD.left - 6} y={toY(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5}>
              {v}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <polygon points={areaPoints} fill="rgb(37 99 235 / 0.1)" />

        {/* Line */}
        <polyline points={points} fill="none" stroke="rgb(37 99 235)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Last point dot */}
        {data.length > 0 && (
          <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1].points)} r={3} fill="rgb(37 99 235)" />
        )}

        {/* X-axis labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d)
          return (
            <text key={i} x={toX(idx)} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>
              {d.month.slice(2)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

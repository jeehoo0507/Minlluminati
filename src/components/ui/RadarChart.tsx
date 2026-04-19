'use client'

interface RadarAxis { label: string; value: number }

interface Props { data: RadarAxis[] }

export function RadarChart({ data }: Props) {
  const SIZE = 240
  const cx = SIZE / 2
  const cy = SIZE / 2
  const R = 72 // max radius

  const n = data.length
  if (n < 3) return null

  const maxVal = Math.max(...data.map((d) => d.value), 1)

  function angle(i: number) {
    return (2 * Math.PI * i) / n - Math.PI / 2
  }

  function pt(i: number, ratio: number) {
    const a = angle(i)
    return { x: cx + R * ratio * Math.cos(a), y: cy + R * ratio * Math.sin(a) }
  }

  // Polygon path for data
  const dataPoints = data.map((d, i) => pt(i, d.value / maxVal))
  const polyStr = dataPoints.map((p) => `${p.x},${p.y}`).join(' ')

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1]

  // Axis lines & labels
  const axes = data.map((d, i) => {
    const tip = pt(i, 1)
    const label = pt(i, 1.35)
    return { ...d, tipX: tip.x, tipY: tip.y, labelX: label.x, labelY: label.y }
  })

  const hasData = data.some((d) => d.value > 0)

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs mx-auto">
      {/* Background rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={data.map((_, i) => { const p = pt(i, r); return `${p.x},${p.y}` }).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={a.tipX} y2={a.tipY} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
      ))}

      {/* Data polygon */}
      {hasData && (
        <>
          <polygon points={polyStr} fill="rgb(37 99 235 / 0.2)" stroke="rgb(37 99 235)" strokeWidth={1.5} />
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgb(37 99 235)" />
          ))}
        </>
      )}

      {/* Labels */}
      {axes.map((a, i) => (
        <text
          key={i}
          x={a.labelX}
          y={a.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8.5}
          fill="currentColor"
          opacity={0.7}
        >
          {a.label}
          {a.value > 0 && ` (${a.value})`}
        </text>
      ))}

      {!hasData && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="currentColor" opacity={0.4}>
          아직 없음
        </text>
      )}
    </svg>
  )
}

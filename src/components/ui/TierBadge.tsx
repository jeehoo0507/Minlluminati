'use client'
import { getTier } from '@/lib/scoring'

interface Props {
  points: number
  showPoints?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function TierBadge({ points, showPoints = false, size = 'sm' }: Props) {
  const tier = getTier(points)
  const sizes = { sm: 'text-xs px-1.5 py-0.5', md: 'text-sm px-2 py-1', lg: 'text-base px-3 py-1.5' }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizes[size]}`}
      style={{ backgroundColor: tier.color + '20', color: tier.color, border: `1px solid ${tier.color}40` }}
    >
      <span>{tier.emoji}</span>
      <span>{tier.name}</span>
      {showPoints && <span className="opacity-70">· {points}pt</span>}
    </span>
  )
}

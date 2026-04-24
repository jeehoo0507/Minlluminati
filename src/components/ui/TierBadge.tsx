'use client'
import { getTier, MASTER_TIER } from '@/lib/scoring'

interface Props {
  points: number
  showPoints?: boolean
  size?: 'sm' | 'md' | 'lg'
  isMaster?: boolean
}

export function TierBadge({ points, showPoints = false, size = 'sm', isMaster = false }: Props) {
  const tier = isMaster ? MASTER_TIER : getTier(points)
  const sizes = { sm: 'text-xs px-1.5 py-0.5', md: 'text-sm px-2 py-1', lg: 'text-base px-3 py-1.5' }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold whitespace-nowrap shrink-0 ${sizes[size]}`}
      style={{
        backgroundColor: tier.bg,
        color: tier.color,
        border: `1px solid ${tier.color}50`,
        ...(isMaster ? { letterSpacing: '0.04em' } : {}),
      }}
    >
      <span>{tier.name}</span>
      {showPoints && <span className="opacity-60">· {points}pt</span>}
    </span>
  )
}

'use client'
import { getProblemTier } from '@/lib/scoring'

interface Props {
  pts: number | null | undefined
  size?: 'sm' | 'md'
}

export function ProblemTierBadge({ pts, size = 'sm' }: Props) {
  const tier = getProblemTier(pts)
  if (!tier) return null

  const px = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center font-semibold rounded border ${px}`}
      style={{ color: tier.color, backgroundColor: tier.bg, borderColor: `${tier.color}40` }}
    >
      {tier.name}
    </span>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const participants = await prisma.contestParticipant.findMany({
    where: { contestId: params.id },
    include: {
      user: { select: { id: true, name: true, image: true, points: true } },
    },
  })

  const submissions = await prisma.contestSubmission.findMany({
    where: { problem: { contestId: params.id }, correct: true },
    include: { problem: { select: { label: true, title: true, points: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Group correct submissions by user
  const subsByUser: Record<string, typeof submissions> = {}
  const lastCorrectAt: Record<string, Date> = {}
  for (const s of submissions) {
    if (!subsByUser[s.userId]) subsByUser[s.userId] = []
    subsByUser[s.userId].push(s)
    // Track the latest correct submission time (last problem solved)
    const t = new Date(s.createdAt)
    if (!lastCorrectAt[s.userId] || t > lastCorrectAt[s.userId]) {
      lastCorrectAt[s.userId] = t
    }
  }

  // Sort: score DESC, then lastCorrectAt ASC (earlier = better), then joinedAt ASC
  const sorted = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aLast = lastCorrectAt[a.userId]?.getTime() ?? Infinity
    const bLast = lastCorrectAt[b.userId]?.getTime() ?? Infinity
    if (aLast !== bLast) return aLast - bLast
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  })

  return NextResponse.json(sorted.map((p, i) => ({
    rank: i + 1,
    ...p,
    solvedProblems: subsByUser[p.userId] ?? [],
    lastCorrectAt: lastCorrectAt[p.userId]?.toISOString() ?? null,
  })))
}

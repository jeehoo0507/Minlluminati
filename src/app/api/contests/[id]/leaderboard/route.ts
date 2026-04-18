import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const participants = await prisma.contestParticipant.findMany({
    where: { contestId: params.id },
    include: {
      user: { select: { id: true, name: true, image: true, points: true } },
    },
    orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
  })

  const submissions = await prisma.contestSubmission.findMany({
    where: { problem: { contestId: params.id }, correct: true },
    include: { problem: { select: { label: true, title: true, points: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const subsByUser: Record<string, typeof submissions> = {}
  for (const s of submissions) {
    if (!subsByUser[s.userId]) subsByUser[s.userId] = []
    subsByUser[s.userId].push(s)
  }

  return NextResponse.json(participants.map((p, i) => ({
    rank: i + 1,
    ...p,
    solvedProblems: subsByUser[p.userId] ?? [],
  })))
}

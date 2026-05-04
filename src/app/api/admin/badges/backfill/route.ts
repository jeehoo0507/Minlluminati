import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { awardBadge } from '@/lib/awardBadge'
import { getFirstRubyUserId } from '@/lib/scoring'
export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({ select: { id: true } })
  let awarded = 0
  const errors: string[] = []

  for (const { id: userId } of users) {
    try {
      // ── 문제 풀기 ──────────────────────────────────────────────────
      const solveCount = await prisma.problemSubmission.count({ where: { userId, correct: true } })
      for (const n of [1, 50, 100, 200, 300, 500, 1000]) {
        if (solveCount >= n) {
          try {
            if (await awardBadge(userId, `solve_${n}`)) awarded++
          } catch (e) { errors.push(`solve_${n}@${userId}: ${e}`) }
        }
      }

      // ── 문제 출제 ──────────────────────────────────────────────────
      const uploadCount = await prisma.problem.count({ where: { authorId: userId } })
      for (const n of [1, 10, 50, 100]) {
        if (uploadCount >= n) {
          try {
            if (await awardBadge(userId, `upload_${n}`)) awarded++
          } catch (e) { errors.push(`upload_${n}@${userId}: ${e}`) }
        }
      }

      // ── 피드 글 ────────────────────────────────────────────────────
      const feedCount = await prisma.post.count({ where: { authorId: userId, deletedAt: null } })
      for (const n of [1, 5, 10, 100]) {
        if (feedCount >= n) {
          try {
            if (await awardBadge(userId, `feed_${n}`)) awarded++
          } catch (e) { errors.push(`feed_${n}@${userId}: ${e}`) }
        }
      }

      // ── 주딱: 하트 10개 이상 받은 글 있는지 ──────────────────────
      try {
        const popularPost = await prisma.post.findFirst({
          where: { authorId: userId, deletedAt: null, likes: { some: {} } },
          select: { _count: { select: { likes: true } } },
          orderBy: { likes: { _count: 'desc' } },
        })
        if (popularPost && popularPost._count.likes >= 10) {
          if (await awardBadge(userId, 'hidden_popular')) awarded++
        }
      } catch (e) { errors.push(`popular@${userId}: ${e}`) }

      // ── 도박왕: "겜블러" 문제 정답 기록 있는지 ───────────────────
      try {
        const gamblerProblem = await prisma.problem.findFirst({ where: { title: '겜블러' } })
        if (gamblerProblem) {
          const solved = await prisma.problemSubmission.findUnique({
            where: { problemId_userId: { problemId: gamblerProblem.id, userId } },
          })
          if (solved?.correct && await awardBadge(userId, 'hidden_gambler')) awarded++
        }
      } catch (e) { errors.push(`gambler@${userId}: ${e}`) }

    } catch (e) {
      errors.push(`user ${userId}: ${e}`)
    }
  }

  // ── first ruby: 최초 루비 달성자 ─────────────────────────────────
  try {
    const firstRubyId = await getFirstRubyUserId()
    if (firstRubyId && await awardBadge(firstRubyId, 'hidden_first_ruby')) awarded++
  } catch (e) { errors.push(`first_ruby: ${e}`) }

  return NextResponse.json({ ok: true, awarded, users: users.length, errors })
}

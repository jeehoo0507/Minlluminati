import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { awardBadge } from '@/lib/awardBadge'
export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({ select: { id: true } })
  let awarded = 0

  for (const { id: userId } of users) {
    // ── 문제 풀기 ──────────────────────────────────────────────────
    const solveCount = await prisma.problemSubmission.count({ where: { userId, correct: true } })
    for (const n of [1, 50, 100, 200, 300, 500, 1000]) {
      if (solveCount >= n && await awardBadge(userId, `solve_${n}`)) awarded++
    }

    // ── 문제 출제 ──────────────────────────────────────────────────
    const uploadCount = await prisma.problem.count({ where: { authorId: userId } })
    for (const n of [1, 10, 50, 100]) {
      if (uploadCount >= n && await awardBadge(userId, `upload_${n}`)) awarded++
    }

    // ── 피드 글 ────────────────────────────────────────────────────
    const feedCount = await prisma.post.count({ where: { authorId: userId, deletedAt: null } })
    for (const n of [1, 5, 10, 100]) {
      if (feedCount >= n && await awardBadge(userId, `feed_${n}`)) awarded++
    }

    // ── 하트 10개 이상 (주딱 - 히든이지만 여기선 체크) ─────────────
    // 히든이므로 별도 트리거로 처리 (backfill에서는 스킵)
  }

  return NextResponse.json({ ok: true, awarded, users: users.length })
}

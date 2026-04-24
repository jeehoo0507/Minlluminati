import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const userId = params.id

  const start = new Date(`${year}-01-01T00:00:00+09:00`)
  const end = new Date(`${year + 1}-01-01T00:00:00+09:00`)

  const streakMap: Record<string, number> = {}

  // Feed posts
  const posts = await prisma.post.findMany({
    where: { authorId: userId, deletedAt: null, createdAt: { gte: start, lt: end } },
    select: { createdAt: true },
  })
  for (const p of posts) {
    const key = new Date(p.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Correct problem submissions
  const subs = await prisma.problemSubmission.findMany({
    where: { userId, correct: true, createdAt: { gte: start, lt: end } },
    select: { createdAt: true },
  })
  for (const s of subs) {
    const key = new Date(s.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Problem uploads
  const problems = await prisma.problem.findMany({
    where: { authorId: userId, createdAt: { gte: start, lt: end } },
    select: { createdAt: true },
  })
  for (const p of problems) {
    const key = new Date(p.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Calculate current streak (consecutive days up to today)
  const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  let streak = 0
  const cur = new Date(todayKST + 'T00:00:00')
  // Look back from today across ALL years (not just selected year)
  const allSubs = await prisma.problemSubmission.findMany({ where: { userId, correct: true }, select: { createdAt: true } })
  const allPosts = await prisma.post.findMany({ where: { authorId: userId, deletedAt: null }, select: { createdAt: true } })
  const allProblems = await prisma.problem.findMany({ where: { authorId: userId }, select: { createdAt: true } })
  const allDays = new Set<string>()
  for (const s of [...allSubs, ...allPosts, ...allProblems]) {
    allDays.add(new Date(s.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }))
  }
  const check = new Date(cur)
  while (true) {
    const key = check.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    if (!allDays.has(key)) break
    streak++
    check.setDate(check.getDate() - 1)
  }

  return NextResponse.json({ streakMap, streak, year })
}

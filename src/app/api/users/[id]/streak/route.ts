import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// Holiday dates that never break streaks (YYYY-MM-DD, KST)
// Dynamically computed so the year is always correct
function buildHolidays() {
  const y = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 4)
  return new Set([`${y}-04-30`, `${y}-05-01`, `${y}-05-02`, `${y}-05-03`])
}
const HOLIDAYS = buildHolidays()

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const userId = params.id
  const isSelf = session?.user?.id === userId

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

  // Load shield usages for this year (for display)
  const shieldUsages = await prisma.streakShieldUsage.findMany({
    where: { userId, date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
    select: { date: true },
  })
  const shieldMap: Record<string, boolean> = {}
  for (const s of shieldUsages) shieldMap[s.date] = true

  // All activity days across all years (for streak calc)
  const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const allSubs = await prisma.problemSubmission.findMany({ where: { userId, correct: true }, select: { createdAt: true } })
  const allPosts = await prisma.post.findMany({ where: { authorId: userId, deletedAt: null }, select: { createdAt: true } })
  const allProblems = await prisma.problem.findMany({ where: { authorId: userId }, select: { createdAt: true } })
  const allDays = new Set<string>()
  for (const s of [...allSubs, ...allPosts, ...allProblems]) {
    allDays.add(new Date(s.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }))
  }

  // All shield usages across all years
  const allShields = await prisma.streakShieldUsage.findMany({ where: { userId }, select: { date: true } })
  const allShieldSet = new Set<string>(allShields.map((s) => s.date))

  // Effective "active" day: has activity OR has shield OR is a holiday
  function isActive(date: string) {
    return allDays.has(date) || allShieldSet.has(date) || HOLIDAYS.has(date)
  }

  // Auto-consume shield: if it's own profile and streaks would break but user has shields
  if (isSelf) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakShieldsOwned: true } })
    let availableShields = user?.streakShieldsOwned ?? 0

    // Check yesterday — if yesterday had no activity and no shield yet, auto-apply
    const yesterday = new Date(todayKST + 'T00:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

    // Only auto-apply if: yesterday has no activity, no shield used, not holiday, user has shields
    // AND today has activity (meaning we're still going), or today has activity
    if (
      availableShields > 0
      && !allDays.has(yesterdayStr)
      && !allShieldSet.has(yesterdayStr)
      && !HOLIDAYS.has(yesterdayStr)
    ) {
      // Check that some day before yesterday was active (otherwise nothing to protect)
      const dayBeforeYesterday = new Date(yesterday)
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1)
      const dbyStr = dayBeforeYesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
      const hadStreakBefore = isActive(dbyStr)

      if (hadStreakBefore) {
        await prisma.$transaction([
          prisma.streakShieldUsage.create({ data: { userId, date: yesterdayStr } }),
          prisma.user.update({ where: { id: userId }, data: { streakShieldsOwned: { decrement: 1 } } }),
        ])
        allShieldSet.add(yesterdayStr)
        shieldMap[yesterdayStr] = true
        availableShields--
      }
    }
  }

  // Calculate current streak (consecutive days going back from today)
  let streak = 0
  const check = new Date(todayKST + 'T00:00:00')
  while (true) {
    const key = check.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    if (!isActive(key)) break
    streak++
    check.setDate(check.getDate() - 1)
  }

  return NextResponse.json({ streakMap, streak, year, shieldMap })
}

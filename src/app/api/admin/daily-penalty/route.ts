import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// KST midnight range for a given date string "YYYY-MM-DD"
function kstDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+09:00`)
  const end = new Date(`${dateStr}T23:59:59.999+09:00`)
  return { start, end }
}

function todayKST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

// GET: return today's posting status for all users
export async function GET(_: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayKST()
  const { start, end } = kstDayRange(today)

  const [allUsers, todayPosts, lastRunCfg] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, image: true, points: true },
      orderBy: { name: 'asc' },
    }),
    prisma.post.findMany({
      where: { createdAt: { gte: start, lte: end }, deletedAt: null },
      select: { authorId: true },
    }),
    prisma.systemConfig.findUnique({ where: { key: 'lastPenaltyDate' } }),
  ])

  const postedUserIds = new Set(todayPosts.map((p) => p.authorId))
  const lastRunDate = lastRunCfg?.value ?? null

  return NextResponse.json({
    date: today,
    lastRunDate,
    alreadyRan: lastRunDate === today,
    posted: allUsers.filter((u) => postedUserIds.has(u.id)),
    notPosted: allUsers.filter((u) => !postedUserIds.has(u.id)),
  })
}

// PATCH: apply penalty to a single user manually
export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { userId } = body

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const pointsCfg = await prisma.systemConfig.findUnique({ where: { key: 'points' } })
  const pts = pointsCfg ? JSON.parse(pointsCfg.value) : {}
  const penalty = Math.abs(Number(pts.dailyPenalty ?? 10))

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, points: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const newPoints = Math.max(0, user.points - penalty)
  await prisma.user.update({ where: { id: userId }, data: { points: newPoints } })

  await prisma.notification.create({
    data: {
      userId,
      type: 'PENALTY',
      title: '일일 미작성 패널티',
      content: `관리자에 의해 ${penalty}pt가 차감되었습니다.`,
      link: '/post/new',
    },
  })

  return NextResponse.json({ ok: true, userId, penalty, newPoints })
}

// POST: apply daily penalty (can be called manually or by cron)
export async function POST(req: NextRequest) {
  // Allow internal cron calls with secret, or admin session
  const body = await req.json().catch(() => ({}))
  const isCron = body.cronSecret === process.env.CRON_SECRET

  if (!isCron) {
    const session = await getAuth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const today = todayKST()

  // Prevent double-run on same day
  const lastRunCfg = await prisma.systemConfig.findUnique({ where: { key: 'lastPenaltyDate' } })
  if (lastRunCfg?.value === today && !body.force) {
    return NextResponse.json({ ok: true, skipped: true, reason: '오늘 이미 실행됨' })
  }

  // Get penalty amount from config
  const pointsCfg = await prisma.systemConfig.findUnique({ where: { key: 'points' } })
  const points = pointsCfg ? JSON.parse(pointsCfg.value) : {}
  const penalty = Math.abs(Number(points.dailyPenalty ?? 10))

  // Yesterday in KST (penalty is for yesterday's missed post)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const { start, end } = kstDayRange(yesterdayStr)

  const [allUsers, yesterdayPosts] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, points: true } }),
    prisma.post.findMany({
      where: { createdAt: { gte: start, lte: end }, deletedAt: null },
      select: { authorId: true },
    }),
  ])

  const postedUserIds = new Set(yesterdayPosts.map((p) => p.authorId))
  const penalizedUsers = allUsers.filter((u) => !postedUserIds.has(u.id) && u.points > 0)

  // Apply penalty in batch
  await Promise.all(
    penalizedUsers.map((u) =>
      prisma.user.update({
        where: { id: u.id },
        data: { points: Math.max(0, u.points - penalty) },
      })
    )
  )

  // Create notifications
  if (penalizedUsers.length > 0) {
    await prisma.notification.createMany({
      data: penalizedUsers.map((u) => ({
        userId: u.id,
        type: 'PENALTY',
        title: '일일 미작성 패널티',
        content: `어제 글을 올리지 않아 ${penalty}pt가 차감되었습니다.`,
        link: '/post/new',
      })),
    })
  }

  // Record run date
  await prisma.systemConfig.upsert({
    where: { key: 'lastPenaltyDate' },
    create: { key: 'lastPenaltyDate', value: today },
    update: { value: today },
  })

  return NextResponse.json({
    ok: true,
    date: yesterdayStr,
    penalizedCount: penalizedUsers.length,
    penalty,
    penalizedUsers: penalizedUsers.map((u) => u.name),
  })
}

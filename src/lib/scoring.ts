import { prisma } from './db'

export const POINTS = {
  LIKE_RECEIVED: 5,
} as const

export const PROBLEM_TIERS = [
  { name: '브론즈', min: 1,   max: 9,         color: '#92400e', bg: '#fef3c7' },
  { name: '실버',   min: 10,  max: 24,         color: '#374151', bg: '#f3f4f6' },
  { name: '골드',   min: 25,  max: 49,         color: '#b45309', bg: '#fffbeb' },
  { name: '플래티넘', min: 50, max: 99,        color: '#0f766e', bg: '#f0fdfa' },
  { name: '다이아', min: 100, max: 199,        color: '#1d4ed8', bg: '#eff6ff' },
  { name: '루비',   min: 200, max: Infinity,   color: '#be123c', bg: '#fff1f2' },
] as const

export function getProblemTier(pts: number | null | undefined) {
  if (!pts || pts <= 0) return null
  return [...PROBLEM_TIERS].reverse().find((t) => pts >= t.min) ?? null
}

export const TIERS = [
  { name: '새싹',    min: 0,    max: 29,         color: '#16a34a', bg: '#f0fdf4' },
  { name: '브론즈',  min: 30,   max: 99,          color: '#92400e', bg: '#fef3c7' },
  { name: '실버',    min: 100,  max: 299,         color: '#374151', bg: '#f3f4f6' },
  { name: '골드',    min: 300,  max: 499,         color: '#b45309', bg: '#fffbeb' },
  { name: '플래티넘', min: 500, max: 999,         color: '#0f766e', bg: '#f0fdfa' },
  { name: '다이아',  min: 1000, max: 1999,        color: '#1d4ed8', bg: '#eff6ff' },
  { name: '루비',    min: 2000, max: Infinity,    color: '#be123c', bg: '#fff1f2' },
] as const

// 상위 3명은 포인트와 무관하게 마스터 (1등, 2등, 3등)
export const MASTER_COUNT = 3
export const MASTER_TIER = { name: '마스터', color: '#f59e0b', bg: '#1e1b4b' } as const

export function getTier(points: number) {
  return TIERS.findLast((t) => points >= t.min) ?? TIERS[0]
}

// 최초 루비 달성자 ID 조회 (PointHistory 기반)
export async function getFirstRubyUserId(): Promise<string | null> {
  const cached = await prisma.systemConfig.findUnique({ where: { key: 'first_ruby_user_id' } })
  if (cached) return cached.value

  const rubyUsers = await prisma.user.findMany({
    where: { points: { gte: 2000 } },
    select: { id: true },
  })
  if (rubyUsers.length === 0) return null

  const userIds = rubyUsers.map((u) => u.id)
  const histories = await prisma.pointHistory.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'asc' },
    select: { userId: true, delta: true },
  })

  const cumulative: Record<string, number> = {}
  let firstRubyUserId: string | null = null
  for (const h of histories) {
    cumulative[h.userId] = (cumulative[h.userId] ?? 0) + h.delta
    if (cumulative[h.userId] >= 2000) { firstRubyUserId = h.userId; break }
  }

  if (firstRubyUserId) {
    await prisma.systemConfig.upsert({
      where: { key: 'first_ruby_user_id' },
      create: { key: 'first_ruby_user_id', value: firstRubyUserId },
      update: { value: firstRubyUserId },
    })
  }
  return firstRubyUserId
}


export async function awardLikePoints(postAuthorId: string, postId: string, subject?: string | null, amount: number = POINTS.LIKE_RECEIVED) {
  if (amount <= 0) return
  await prisma.$transaction([
    prisma.user.update({ where: { id: postAuthorId }, data: { points: { increment: amount } } }),
    prisma.post.update({ where: { id: postId }, data: { pointsAwarded: { increment: amount } } }),
    prisma.pointHistory.create({ data: { userId: postAuthorId, delta: amount, reason: '추천 받음', subject: subject ?? undefined } }),
  ])
}

export async function revokeLikePoints(postAuthorId: string, postId: string, subject?: string | null, amount: number = POINTS.LIKE_RECEIVED) {
  if (amount <= 0) return
  await prisma.$transaction([
    prisma.user.update({ where: { id: postAuthorId }, data: { points: { decrement: amount } } }),
    prisma.post.update({ where: { id: postId }, data: { pointsAwarded: { decrement: amount } } }),
    prisma.pointHistory.create({ data: { userId: postAuthorId, delta: -amount, reason: '추천 취소', subject: subject ?? undefined } }),
  ])
}

export async function awardContestPrize(userId: string, amount: number, place: number) {
  const placeStr = ['1등', '2등', '3등'][place - 1] ?? `${place}등`
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { points: { increment: amount } } }),
    prisma.pointHistory.create({ data: { userId, delta: amount, reason: `대회 ${placeStr} 포상` } }),
  ])
}

export async function revokeAllPostPoints(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, pointsAwarded: true, subject: true },
  })
  if (!post || post.pointsAwarded <= 0) return
  await prisma.$transaction([
    prisma.user.update({
      where: { id: post.authorId },
      data: { points: { decrement: post.pointsAwarded } },
    }),
    prisma.pointHistory.create({
      data: { userId: post.authorId, delta: -post.pointsAwarded, reason: '글 삭제', subject: post.subject },
    }),
  ])
}

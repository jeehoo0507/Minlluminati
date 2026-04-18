import { prisma } from './db'

export const POINTS = {
  POST_CREATE: 10,
  LIKE_RECEIVED: 2,
} as const

export const TIERS = [
  { name: '새싹', min: 0,    max: 29,   color: '#86efac', emoji: '🌱' },
  { name: '나무', min: 30,   max: 99,   color: '#4ade80', emoji: '🌳' },
  { name: '별',   min: 100,  max: 249,  color: '#facc15', emoji: '⭐' },
  { name: '달',   min: 250,  max: 499,  color: '#60a5fa', emoji: '🌙' },
  { name: '해',   min: 500,  max: 999,  color: '#f97316', emoji: '☀️' },
  { name: '전설', min: 1000, max: Infinity, color: '#c084fc', emoji: '👑' },
] as const

export function getTier(points: number) {
  return TIERS.findLast((t) => points >= t.min) ?? TIERS[0]
}

export async function awardPostPoints(userId: string, postId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { points: { increment: POINTS.POST_CREATE } },
    }),
    prisma.post.update({
      where: { id: postId },
      data: { pointsAwarded: { increment: POINTS.POST_CREATE } },
    }),
  ])
}

export async function awardLikePoints(postAuthorId: string, postId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: postAuthorId },
      data: { points: { increment: POINTS.LIKE_RECEIVED } },
    }),
    prisma.post.update({
      where: { id: postId },
      data: { pointsAwarded: { increment: POINTS.LIKE_RECEIVED } },
    }),
  ])
}

export async function revokeLikePoints(postAuthorId: string, postId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: postAuthorId },
      data: { points: { decrement: POINTS.LIKE_RECEIVED } },
    }),
    prisma.post.update({
      where: { id: postId },
      data: { pointsAwarded: { decrement: POINTS.LIKE_RECEIVED } },
    }),
  ])
}

// 관리자가 포스트 삭제 시 해당 포스트로 얻은 모든 점수 환수
export async function revokeAllPostPoints(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, pointsAwarded: true },
  })
  if (!post || post.pointsAwarded <= 0) return

  await prisma.user.update({
    where: { id: post.authorId },
    data: { points: { decrement: post.pointsAwarded } },
  })
}

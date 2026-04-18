import { prisma } from './db'

export const POINTS = {
  POST_CREATE: 10,
  LIKE_RECEIVED: 2,
} as const

export const TIERS = [
  { name: '브론즈', min: 0,    max: 29,   color: '#92400e', bg: '#fef3c7' },
  { name: '실버',   min: 30,   max: 99,   color: '#374151', bg: '#f3f4f6' },
  { name: '골드',   min: 100,  max: 249,  color: '#b45309', bg: '#fffbeb' },
  { name: '플래티넘',min: 250, max: 499,  color: '#0f766e', bg: '#f0fdfa' },
  { name: '다이아', min: 500,  max: 999,  color: '#1d4ed8', bg: '#eff6ff' },
  { name: '마스터', min: 1000, max: Infinity, color: '#7c3aed', bg: '#f5f3ff' },
] as const

export function getTier(points: number) {
  return TIERS.findLast((t) => points >= t.min) ?? TIERS[0]
}

export async function awardPostPoints(userId: string, postId: string, subject?: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { points: { increment: POINTS.POST_CREATE } } }),
    prisma.post.update({ where: { id: postId }, data: { pointsAwarded: { increment: POINTS.POST_CREATE } } }),
    prisma.pointHistory.create({ data: { userId, delta: POINTS.POST_CREATE, reason: '문제 등록', subject } }),
  ])
}

export async function awardLikePoints(postAuthorId: string, postId: string, subject?: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: postAuthorId }, data: { points: { increment: POINTS.LIKE_RECEIVED } } }),
    prisma.post.update({ where: { id: postId }, data: { pointsAwarded: { increment: POINTS.LIKE_RECEIVED } } }),
    prisma.pointHistory.create({ data: { userId: postAuthorId, delta: POINTS.LIKE_RECEIVED, reason: '추천 받음', subject } }),
  ])
}

export async function revokeLikePoints(postAuthorId: string, postId: string, subject?: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: postAuthorId }, data: { points: { decrement: POINTS.LIKE_RECEIVED } } }),
    prisma.post.update({ where: { id: postId }, data: { pointsAwarded: { decrement: POINTS.LIKE_RECEIVED } } }),
    prisma.pointHistory.create({ data: { userId: postAuthorId, delta: -POINTS.LIKE_RECEIVED, reason: '추천 취소', subject } }),
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

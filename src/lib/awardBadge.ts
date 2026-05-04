import { prisma } from './db'

/** 뱃지를 지급합니다. 이미 보유 중이면 false 반환 */
export async function awardBadge(userId: string, badgeKey: string): Promise<boolean> {
  const badge = await prisma.badge.findUnique({ where: { key: badgeKey } })
  if (!badge || !badge.isActive) return false

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  })
  if (existing) return false

  await prisma.$transaction([
    prisma.userBadge.create({ data: { userId, badgeId: badge.id } }),
    prisma.notification.create({
      data: {
        userId,
        type: 'BADGE',
        title: '🏅 새 뱃지 획득!',
        content: `"${badge.name}" 뱃지를 획득했습니다${badge.title ? ` (칭호: ${badge.title})` : ''}.`,
        link: `/profile/${userId}`,
      },
    }),
  ])
  return true
}

// ── 문제 풀기 ─────────────────────────────────────────────────────
export async function checkSolveBadges(userId: string) {
  const count = await prisma.problemSubmission.count({ where: { userId, correct: true } })
  const thresholds = [1, 50, 100, 200, 300, 500, 1000]
  for (const n of thresholds) {
    if (count >= n) await awardBadge(userId, `solve_${n}`)
  }
}

// ── 문제 출제 ─────────────────────────────────────────────────────
export async function checkUploadBadges(userId: string) {
  const count = await prisma.problem.count({ where: { authorId: userId } })
  const thresholds = [1, 10, 50, 100]
  for (const n of thresholds) {
    if (count >= n) await awardBadge(userId, `upload_${n}`)
  }
}

// ── 피드 글 작성 ──────────────────────────────────────────────────
export async function checkFeedBadges(userId: string) {
  const count = await prisma.post.count({ where: { authorId: userId, deletedAt: null } })
  const thresholds = [1, 5, 10, 100]
  for (const n of thresholds) {
    if (count >= n) await awardBadge(userId, `feed_${n}`)
  }
}

// ── 스트릭 ────────────────────────────────────────────────────────
export async function checkStreakBadges(userId: string, streak: number) {
  const thresholds = [
    { n: 10, key: 'streak_10' },
    { n: 100, key: 'streak_100' },
    { n: 200, key: 'streak_200' },
    { n: 300, key: 'streak_300' },
    { n: 365, key: 'streak_365' },
  ]
  for (const { n, key } of thresholds) {
    if (streak >= n) await awardBadge(userId, key)
  }
}

// ── 대회 우승 ─────────────────────────────────────────────────────
export async function checkContestWinBadges(userId: string) {
  // 대회 우승 횟수: ContestParticipant에서 1등(score 최대)인 경우 카운트
  // 실제 로직은 대회 종료 시 호출됨 - 여기선 기록 기반으로 체크
  // TODO: 대회 우승 기록 모델이 없으므로 추후 구현
}

// ── 하트 10개 이상 (주딱) ─────────────────────────────────────────
export async function checkPopularBadge(userId: string) {
  const posts = await prisma.post.findMany({
    where: { authorId: userId, deletedAt: null },
    select: { _count: { select: { likes: true } } },
  })
  const hasPopular = posts.some((p) => p._count.likes >= 10)
  if (hasPopular) await awardBadge(userId, 'hidden_popular')
}

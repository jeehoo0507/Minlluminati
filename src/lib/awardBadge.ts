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

// ── Linear algebra 문제집 완주 ────────────────────────────────────
export async function checkLinearAlgebraBadge(userId: string): Promise<boolean> {
  // SQLite는 mode:'insensitive' 미지원 → raw query로 LOWER() 비교
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM problem_sets WHERE LOWER(TRIM(title)) LIKE '%linear algebra%' LIMIT 1
  `
  if (!rows.length) return false

  const problemSet = await prisma.problemSet.findUnique({
    where: { id: rows[0].id },
    include: { items: { select: { problemId: true } } },
  })
  if (!problemSet || problemSet.items.length === 0) return false

  const problemIds = problemSet.items.map((i) => i.problemId)
  const solvedCount = await prisma.problemSubmission.count({
    where: { userId, correct: true, problemId: { in: problemIds } },
  })
  if (solvedCount < problemIds.length) return false

  // 뱃지가 없으면 자동 생성 (히든)
  await prisma.badge.upsert({
    where: { key: 'hidden_linear_algebra' },
    create: {
      key: 'hidden_linear_algebra',
      name: '선형대수학자',
      description: 'Linear algebra 문제집의 모든 문제를 해결했습니다.',
      title: '선형대수학자',
      isHidden: true,
      isActive: true,
      sortOrder: 99,
    },
    update: {},
  })

  return awardBadge(userId, 'hidden_linear_algebra')
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

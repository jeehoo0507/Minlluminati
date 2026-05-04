export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron')
    const { prisma } = await import('./lib/db')
    const { BADGE_DEFS } = await import('./lib/badgeDefs')
    const { awardBadge } = await import('./lib/awardBadge')

    // ── 뱃지 시드: 정의된 뱃지가 DB에 없으면 생성 ──────────────────
    try {
      for (const def of BADGE_DEFS) {
        await prisma.badge.upsert({
          where: { key: def.key },
          create: {
            key: def.key,
            name: def.name,
            description: def.description,
            title: def.title ?? null,
            isHidden: def.isHidden,
            sortOrder: def.sortOrder,
          },
          update: {
            name: def.name,
            description: def.description,
            title: def.title ?? null,
            isHidden: def.isHidden,
            sortOrder: def.sortOrder,
          },
        })
      }
      console.log('[badge-seed] 뱃지 시드 완료')

      // first ruby 뱃지: 기존 first ruby 유저에게 자동 지급
      const { getFirstRubyUserId } = await import('./lib/scoring')
      const firstRubyId = await getFirstRubyUserId()
      if (firstRubyId) {
        await awardBadge(firstRubyId, 'hidden_first_ruby')
      }
    } catch (e) {
      console.error('[badge-seed] 오류:', e)
    }

    // Run at 00:00 KST every day
    cron.default.schedule(
      '0 0 * * *',
      async () => {
        try {
          const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

          // Prevent double-run
          const lastRun = await prisma.systemConfig.findUnique({ where: { key: 'lastPenaltyDate' } })
          if (lastRun?.value === today) return

          // Get penalty amount
          const pointsCfg = await prisma.systemConfig.findUnique({ where: { key: 'points' } })
          const pts = pointsCfg ? JSON.parse(pointsCfg.value) : {}
          const penalty = Math.abs(Number(pts.dailyPenalty ?? 10))

          // Yesterday range in KST
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yStr = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
          const start = new Date(`${yStr}T00:00:00+09:00`)
          const end = new Date(`${yStr}T23:59:59.999+09:00`)

          const [allUsers, posts] = await Promise.all([
            prisma.user.findMany({ select: { id: true, name: true, points: true } }),
            prisma.post.findMany({
              where: { createdAt: { gte: start, lte: end }, deletedAt: null },
              select: { authorId: true },
            }),
          ])

          const postedIds = new Set(posts.map((p) => p.authorId))
          const penalized = allUsers.filter((u) => !postedIds.has(u.id) && u.points > 0)

          await Promise.all(
            penalized.map((u) =>
              prisma.user.update({
                where: { id: u.id },
                data: { points: Math.max(0, u.points - penalty) },
              })
            )
          )

          if (penalized.length > 0) {
            await prisma.notification.createMany({
              data: penalized.map((u) => ({
                userId: u.id,
                type: 'PENALTY',
                title: '일일 미작성 패널티',
                content: `어제 글을 올리지 않아 ${penalty}pt가 차감되었습니다.`,
                link: '/post/new',
              })),
            })
          }

          await prisma.systemConfig.upsert({
            where: { key: 'lastPenaltyDate' },
            create: { key: 'lastPenaltyDate', value: today },
            update: { value: today },
          })

          console.log(`[daily-penalty] ${yStr}: ${penalized.length}명 차감 (${penalty}pt)`)
        } catch (e) {
          console.error('[daily-penalty] 오류:', e)
        }
      },
      { timezone: 'Asia/Seoul' }
    )

    console.log('[instrumentation] 일일 패널티 크론 등록 완료 (매일 00:00 KST)')
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// 완주 보너스 (shopPoints)
const COMPLETION_BONUS = 20

// KST (UTC+9) 기준 이번 주 월요일 날짜 반환 (YYYY-MM-DD)
function getWeekStart(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay() // 0=일, 1=월 ...
  const diff = day === 0 ? 6 : day - 1
  kst.setUTCDate(kst.getUTCDate() - diff)
  return kst.toISOString().slice(0, 10)
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

// 사용자 포인트 → 마라톤 문제 approvedPts 범위 (점차 어려워지도록 7개)
function getMarathonPtsRange(userPoints: number): { min: number; max: number } {
  if (userPoints < 30)   return { min: 1,   max: 20  } // 새싹
  if (userPoints < 100)  return { min: 5,   max: 30  } // 브론즈
  if (userPoints < 300)  return { min: 10,  max: 50  } // 실버
  if (userPoints < 500)  return { min: 20,  max: 80  } // 골드
  if (userPoints < 1000) return { min: 30,  max: 120 } // 플래티넘
  if (userPoints < 2000) return { min: 60,  max: 200 } // 다이아
  return { min: 100, max: 99999 }                       // 루비/마스터
}

const PROBLEM_SELECT = {
  id: true,
  problemNumber: true,
  title: true,
  subject: true,
  approvedPts: true,
} as const

// ──────────────────────────────────────────
// GET  — 현재 주 마라톤 세션 가져오기 (없으면 생성)
//        풀이 상태 동기화 + 보너스 shopPoints 지급
// ──────────────────────────────────────────
export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId   = session.user.id
  const weekStart = getWeekStart()
  const weekEnd   = getWeekEnd(weekStart)

  // 기존 세션 조회
  let marathonSession = await prisma.marathonSession.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: {
      items: {
        include: { problem: { select: PROBLEM_SELECT } },
        orderBy: { order: 'asc' },
      },
    },
  })

  // ── 세션이 없으면 새로 생성 ──
  if (!marathonSession) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const range = getMarathonPtsRange(user.points)

    // 이미 맞힌 문제 ID 목록
    const solvedSubs = await prisma.problemSubmission.findMany({
      where: { userId, correct: true },
      select: { problemId: true },
    })
    const solvedIds = solvedSubs.map((s) => s.problemId)

    // 가능한 문제: 승인됨·비서술형·티어 범위 내·미풀이
    const eligible = await prisma.problem.findMany({
      where: {
        status: 'APPROVED',
        isEssay: false,
        approvedPts: { gte: range.min, lte: range.max },
        ...(solvedIds.length > 0 ? { id: { notIn: solvedIds } } : {}),
      },
      select: { id: true, approvedPts: true },
      orderBy: { approvedPts: 'asc' },
    })

    if (eligible.length < 7) {
      return NextResponse.json({
        closed: true,
        availableCount: eligible.length,
        weekStart,
        weekEnd,
      })
    }

    // 같은 pts 묶음 내 셔플 → 전체는 pts 오름차순 유지 → 앞 7개
    const grouped = new Map<number, { id: string; pts: number }[]>()
    for (const p of eligible) {
      const pts = p.approvedPts!
      if (!grouped.has(pts)) grouped.set(pts, [])
      grouped.get(pts)!.push({ id: p.id, pts })
    }
    const shuffled: { id: string; pts: number }[] = []
    grouped.forEach((items) => {
      items.sort(() => Math.random() - 0.5)
      items.forEach((it) => shuffled.push(it))
    })
    shuffled.sort((a, b) => a.pts - b.pts)
    const selected = shuffled.slice(0, 7)

    // 세션 + 아이템 생성
    // 마라톤 보너스 shopPoints = 해당 문제의 approvedPts (사용자 요청)
    marathonSession = await prisma.marathonSession.create({
      data: {
        userId,
        weekStart,
        items: {
          create: selected.map((p, i) => ({
            problemId: p.id,
            order: i + 1,
            bonusPts: p.pts ?? 0, // approvedPts와 동일
          })),
        },
      },
      include: {
        items: {
          include: { problem: { select: PROBLEM_SELECT } },
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  // ── 풀이 상태 동기화 ──
  const problemIds = marathonSession.items.map((it) => it.problemId)
  const correctSubs = await prisma.problemSubmission.findMany({
    where: { userId, problemId: { in: problemIds }, correct: true },
    select: { problemId: true },
  })
  const solvedSet = new Set(correctSubs.map((s) => s.problemId))

  // 아직 marathon에서 solved=false 인데 실제로 맞힌 것
  const unsynced = marathonSession.items.filter(
    (it) => !it.solved && solvedSet.has(it.problemId)
  )

  let bonusAwarded = 0
  let completionBonus = 0

  if (unsynced.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const item of unsynced) {
        const bonus = !item.bonusAwarded && item.bonusPts > 0 ? item.bonusPts : 0
        bonusAwarded += bonus

        await tx.marathonItem.update({
          where: { id: item.id },
          data: {
            solved: true,
            solvedAt: new Date(),
            bonusAwarded: bonus > 0 ? true : item.bonusAwarded,
          },
        })

        if (bonus > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { shopPoints: { increment: bonus } },
          })
        }
      }
    })

    // 최신 세션 재조회
    marathonSession = (await prisma.marathonSession.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: {
        items: {
          include: { problem: { select: PROBLEM_SELECT } },
          orderBy: { order: 'asc' },
        },
      },
    }))!
  }

  // ── 완주 보너스 ──
  const allSolved = marathonSession.items.every((it) => it.solved)
  if (allSolved && !marathonSession.completionBonusAwarded) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { shopPoints: { increment: COMPLETION_BONUS } },
      }),
      prisma.marathonSession.update({
        where: { id: marathonSession.id },
        data: { completionBonusAwarded: true },
      }),
    ])
    marathonSession = { ...marathonSession, completionBonusAwarded: true }
    completionBonus = COMPLETION_BONUS
  }

  return NextResponse.json({
    session: marathonSession,
    weekStart,
    weekEnd,
    newlySolvedCount: unsynced.length,
    bonusAwarded,
    completionBonus,
  })
}

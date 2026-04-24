import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { SUBJECTS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = params.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, image: true, points: true, role: true, createdAt: true,
      _count: { select: { posts: { where: { deletedAt: null } }, comments: true } },
      posts: {
        where: { deletedAt: null },
        select: { id: true, subject: true, pointsAwarded: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Subject breakdown
  const subjectCount: Record<string, number> = {}
  for (const p of user.posts) {
    subjectCount[p.subject] = (subjectCount[p.subject] ?? 0) + 1
  }

  // Streak: count posts + correct problem submissions + problem uploads per day for last 365 days
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)
  const streakMap: Record<string, number> = {}

  // Feed posts
  for (const p of user.posts) {
    const d = new Date(p.createdAt)
    if (d < since) continue
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Correct problem submissions
  const correctSubs = await prisma.problemSubmission.findMany({
    where: { userId, correct: true, createdAt: { gte: since } },
    select: { createdAt: true },
  })
  for (const s of correctSubs) {
    const d = new Date(s.createdAt)
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // Problem uploads
  const uploadedProblems = await prisma.problem.findMany({
    where: { authorId: userId, createdAt: { gte: since } },
    select: { createdAt: true },
  })
  for (const p of uploadedProblems) {
    const d = new Date(p.createdAt)
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    streakMap[key] = (streakMap[key] ?? 0) + 1
  }

  // pointTimeline is now served by /api/users/[id]/points — keep empty for compat
  const pointTimeline: { date: string; points: number }[] = []

  // Radar data: 6개 활동 축
  const COMMUNITY_SUBJECTS = ['QUESTION', 'BOARD', 'FREE', 'TIPS']
  const ACADEMIC_SUBJECTS  = ['MATH1', 'MATH2', 'PROOF', 'PHYSICS', 'CHEMISTRY', 'EARTH', 'CS']

  // 1) 문제 풀기 — 전체 기간 정답 수
  const solvedCount = await prisma.problemSubmission.count({ where: { userId, correct: true } })

  // 2) 문제 출제 — 올린 문제 수
  const uploadedCount = await prisma.problem.count({ where: { authorId: userId } })

  // 3) 커뮤니티 — QUESTION / BOARD / FREE / TIPS 피드 글 수
  const communityCount = COMMUNITY_SUBJECTS.reduce((s, k) => s + (subjectCount[k] ?? 0), 0)

  // 4) 학문 기여 — 수학·과학·CS 등 과목 피드 글 수
  const academicCount = ACADEMIC_SUBJECTS.reduce((s, k) => s + (subjectCount[k] ?? 0), 0)

  // 5) 대회 출제/검토 — ContestContributor 참여 횟수
  const contestContribCount = await prisma.contestContributor.count({ where: { userId } })

  // 6) 대회 참가 — ContestParticipant 참여 횟수
  const contestParticipantCount = await prisma.contestParticipant.count({ where: { userId } })

  const radarData = [
    { label: '문제 풀기',      value: solvedCount },
    { label: '문제 출제',      value: uploadedCount },
    { label: '커뮤니티',       value: communityCount * 5 },
    { label: '학문 기여',      value: academicCount * 5 },
    { label: '대회 출제·검토', value: contestContribCount * 10 },
    { label: '대회 참가',      value: contestParticipantCount * 10 },
  ]

  // Solved problems list
  const solvedSubmissions = await prisma.problemSubmission.findMany({
    where: { userId, correct: true },
    select: { problemId: true, createdAt: true, problem: { select: { id: true, problemNumber: true, title: true, subject: true } } },
    orderBy: { createdAt: 'desc' },
    distinct: ['problemId'],
  })
  const solvedProblems = solvedSubmissions.map((s) => s.problem)

  // Rivals info
  const myRivals = session?.user
    ? await prisma.rival.findMany({ where: { userId: session.user.id }, select: { rivalId: true } })
    : []
  const isRival = myRivals.some((r) => r.rivalId === userId)

  const rivals = await prisma.rival.findMany({
    where: { userId },
    include: { rival: { select: { id: true, name: true, image: true, points: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    ...user,
    posts: user.posts.slice(-20).reverse(),
    subjectCount,
    streakMap,
    pointTimeline,
    radarData,
    solvedProblems,
    isRival,
    rivals: rivals.map((r) => r.rival),
  })
}

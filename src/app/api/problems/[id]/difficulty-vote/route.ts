import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/problems/[id]/difficulty-vote — 난이도 투표 (정답자만 가능)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { difficulty } = await req.json() as { difficulty: number }
  if (!difficulty || difficulty < 1 || difficulty > 5) {
    return NextResponse.json({ error: '난이도는 1~5 사이여야 합니다' }, { status: 400 })
  }

  const userId = session.user.id
  const problemId = params.id

  // 정답자만 투표 가능 (서술형은 에세이 제출 정답 기준)
  const solved = await prisma.problemSubmission.findFirst({
    where: { problemId, userId, correct: true },
  })
  const essaySolved = !solved && await prisma.problemEssaySubmission.findFirst({
    where: { problemId, userId, status: 'APPROVED' },
  })
  if (!solved && !essaySolved) {
    return NextResponse.json({ error: '문제를 풀어야 난이도를 평가할 수 있습니다' }, { status: 403 })
  }

  // upsert — 이미 투표했으면 변경
  await prisma.difficultyVote.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { difficulty },
    create: { userId, problemId, difficulty },
  })

  // 현재 평균 난이도 반환
  const agg = await prisma.difficultyVote.aggregate({
    where: { problemId },
    _avg: { difficulty: true },
    _count: { difficulty: true },
  })

  return NextResponse.json({
    myVote: difficulty,
    avg: agg._avg.difficulty ? Math.round(agg._avg.difficulty * 10) / 10 : null,
    count: agg._count.difficulty,
  })
}

// GET /api/problems/[id]/difficulty-vote — 현재 투표 현황
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()

  const agg = await prisma.difficultyVote.aggregate({
    where: { problemId: params.id },
    _avg: { difficulty: true },
    _count: { difficulty: true },
  })

  let myVote = null
  if (session?.user) {
    const mine = await prisma.difficultyVote.findUnique({
      where: { userId_problemId: { userId: session.user.id, problemId: params.id } },
    })
    myVote = mine?.difficulty ?? null
  }

  return NextResponse.json({
    avg: agg._avg.difficulty ? Math.round(agg._avg.difficulty * 10) / 10 : null,
    count: agg._count.difficulty,
    myVote,
  })
}

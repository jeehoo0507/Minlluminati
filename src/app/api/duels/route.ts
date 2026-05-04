import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: list my duels
export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const duels = await prisma.duel.findMany({
    where: {
      OR: [{ challengerId: userId }, { challengedId: userId }],
      status: { in: ['PENDING', 'ACTIVE', 'FINISHED', 'DECLINED'] },
    },
    include: {
      challenger: { select: { id: true, name: true, image: true, points: true } },
      challenged: { select: { id: true, name: true, image: true, points: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json(duels)
}

// POST: create duel challenge
export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetName, excludedSubjects, difficulties, problemCount, timeLimit, allowSolved } = await req.json()

  if (!targetName?.trim()) return NextResponse.json({ error: '상대방 닉네임을 입력하세요' }, { status: 400 })
  if (!difficulties?.length) return NextResponse.json({ error: '난이도를 선택하세요' }, { status: 400 })
  if (!problemCount || problemCount < 1 || problemCount > 30)
    return NextResponse.json({ error: '문제 수는 1~30 사이여야 합니다' }, { status: 400 })
  if (!timeLimit || timeLimit < 60 || timeLimit > 3600)
    return NextResponse.json({ error: '제한 시간은 1분~1시간 사이여야 합니다' }, { status: 400 })

  const challenged = await prisma.user.findFirst({ where: { name: targetName.trim() } })
  if (!challenged) return NextResponse.json({ error: '해당 닉네임의 유저를 찾을 수 없습니다' }, { status: 404 })
  if (challenged.id === session.user.id)
    return NextResponse.json({ error: '자기 자신에게 대결 신청할 수 없습니다' }, { status: 400 })

  // Check existing active/pending duel between these two
  const existing = await prisma.duel.findFirst({
    where: {
      OR: [
        { challengerId: session.user.id, challengedId: challenged.id },
        { challengerId: challenged.id, challengedId: session.user.id },
      ],
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })
  if (existing) return NextResponse.json({ error: '이미 진행 중인 대결이 있습니다' }, { status: 409 })

  const duel = await prisma.duel.create({
    data: {
      challengerId: session.user.id,
      challengedId: challenged.id,
      excludedSubjects: JSON.stringify(excludedSubjects ?? []),
      difficulties: JSON.stringify(difficulties),
      problemCount,
      timeLimit,
      allowSolved: allowSolved !== false,
    },
    include: {
      challenger: { select: { id: true, name: true, image: true, points: true } },
      challenged: { select: { id: true, name: true, image: true, points: true } },
    },
  })

  await prisma.notification.create({
    data: {
      userId: challenged.id,
      type: 'DUEL_CHALLENGE',
      title: '대결 신청이 왔습니다! ⚔️',
      content: `${session.user.name}님이 1:1 대결을 신청했습니다. randB 탭에서 확인하세요.`,
      link: '/problems/randb',
    },
  })

  return NextResponse.json(duel, { status: 201 })
}

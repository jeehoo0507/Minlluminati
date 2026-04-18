import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const contests = await prisma.contest.findMany({
    where: { status: { in: ['APPROVED', 'ONGOING', 'ENDED'] } },
    include: {
      organizer: { select: { id: true, name: true, image: true } },
      _count: { select: { participants: true, problems: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contests)
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = session.user.role === 'ADMIN'
  const isOrganizer = await prisma.contestOrganizer.findUnique({ where: { userId: session.user.id } })
  if (!isAdmin && !isOrganizer) return NextResponse.json({ error: '대회 개설 권한이 없습니다' }, { status: 403 })

  const { title, description, rules, durationMin, problems } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: '대회명을 입력해주세요' }, { status: 400 })
  if (!problems?.length) return NextResponse.json({ error: '문제를 1개 이상 추가해주세요' }, { status: 400 })

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const contest = await prisma.contest.create({
    data: {
      title: title.trim(),
      description: description?.trim() ?? '',
      rules: rules?.trim() ?? '',
      durationMin: durationMin ?? 120,
      organizerId: session.user.id,
      status: isAdmin ? 'APPROVED' : 'PENDING',
      problems: {
        create: problems.map((p: { title: string; content: string; answer: string; points: number }, i: number) => ({
          label: labels[i] ?? String(i + 1),
          title: p.title,
          content: p.content,
          answer: p.answer,
          points: p.points ?? 100,
          order: i,
        })),
      },
    },
    include: { problems: true },
  })
  return NextResponse.json(contest, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: true },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  const isContributor = contest.contributors.some((c) => c.userId === session.user!.id)
  if (!isOrganizer && !isAdmin && !isContributor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const chats = await prisma.contestChat.findMany({
    where: { contestId: params.id },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json(chats)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: true },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  const isContributor = contest.contributors.some((c) => c.userId === session.user!.id)
  if (!isOrganizer && !isAdmin && !isContributor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (['ONGOING', 'ENDED'].includes(contest.status)) {
    return NextResponse.json({ error: '대회 시작 후 채팅이 종료됩니다' }, { status: 400 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: '내용을 입력하세요' }, { status: 400 })
  if (content.trim().length > 500) return NextResponse.json({ error: '채팅은 500자 이하여야 합니다' }, { status: 400 })

  const chat = await prisma.contestChat.create({
    data: { contestId: params.id, authorId: session.user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true, image: true } } },
  })
  return NextResponse.json(chat)
}

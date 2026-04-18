import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const after = searchParams.get('after')

  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId: params.id,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    include: { author: { select: { id: true, name: true, image: true, points: true } } },
    orderBy: { createdAt: 'asc' },
    take: after ? 100 : 50,
  })
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: params.id, userId: session.user.id } },
  })
  if (!member) return NextResponse.json({ error: '그룹 멤버만 채팅할 수 있습니다' }, { status: 403 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })

  const message = await prisma.groupMessage.create({
    data: { groupId: params.id, authorId: session.user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true, image: true, points: true } } },
  })
  return NextResponse.json(message, { status: 201 })
}

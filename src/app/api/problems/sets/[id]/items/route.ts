import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await prisma.problemSet.findUnique({ where: { id: params.id } })
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = set.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { problemNumber } = await req.json()
  if (!problemNumber) return NextResponse.json({ error: '문제 번호를 입력해주세요' }, { status: 400 })

  const problem = await prisma.problem.findUnique({ where: { problemNumber: parseInt(String(problemNumber)) } })
  if (!problem) return NextResponse.json({ error: `#${problemNumber} 문제를 찾을 수 없습니다` }, { status: 404 })
  if (problem.status !== 'APPROVED') {
    return NextResponse.json({ error: '승인된 문제만 추가할 수 있습니다' }, { status: 400 })
  }

  // Check if already in set
  const existing = await prisma.problemSetItem.findUnique({
    where: { setId_problemId: { setId: params.id, problemId: problem.id } },
  })
  if (existing) return NextResponse.json({ error: '이미 문제집에 포함된 문제입니다' }, { status: 400 })

  // Get max order
  const maxOrder = await prisma.problemSetItem.aggregate({
    where: { setId: params.id },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? 0) + 1

  const item = await prisma.problemSetItem.create({
    data: { setId: params.id, problemId: problem.id, order: nextOrder },
    include: {
      problem: {
        include: {
          author: { select: { id: true, name: true, image: true, points: true } },
          _count: { select: { submissions: true } },
        },
      },
    },
  })

  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await prisma.problemSet.findUnique({ where: { id: params.id } })
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = set.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { problemId } = await req.json()
  if (!problemId) return NextResponse.json({ error: 'problemId is required' }, { status: 400 })

  await prisma.problemSetItem.deleteMany({
    where: { setId: params.id, problemId },
  })

  return NextResponse.json({ ok: true })
}

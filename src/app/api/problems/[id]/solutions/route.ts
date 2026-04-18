import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const solutions = await prisma.problemSolution.findMany({
    where: { problemId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json({ solutions })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { content, imageUrls } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: '풀이 내용을 입력해주세요' }, { status: 400 })

  const solution = await prisma.problemSolution.create({
    data: {
      problemId: params.id,
      authorId: session.user.id,
      content: content.trim(),
      imageUrls: JSON.stringify(imageUrls ?? []),
    },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json(solution, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string; solutionId: string } }) {
  const solution = await prisma.problemSolution.findUnique({
    where: { id: params.solutionId },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, image: true, points: true } },
        },
      },
    },
  })

  if (!solution || solution.problemId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(solution)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; solutionId: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const solution = await prisma.problemSolution.findUnique({ where: { id: params.solutionId } })
  if (!solution || solution.problemId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isAuthor = solution.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.problemSolution.delete({ where: { id: params.solutionId } })

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string; solutionId: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const solution = await prisma.problemSolution.findUnique({ where: { id: params.solutionId } })
  if (!solution || solution.problemId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: '댓글 내용을 입력해주세요' }, { status: 400 })

  const comment = await prisma.solutionComment.create({
    data: {
      solutionId: params.solutionId,
      authorId: session.user.id,
      content: content.trim(),
    },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
    },
  })

  return NextResponse.json(comment, { status: 201 })
}

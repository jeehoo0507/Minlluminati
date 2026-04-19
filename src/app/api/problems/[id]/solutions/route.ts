import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()

  // 어드민은 항상 열람 가능
  if (session?.user?.role === 'ADMIN') {
    const solutions = await prisma.problemSolution.findMany({
      where: { problemId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, image: true, points: true } },
        _count: { select: { comments: true } },
      },
    })
    return NextResponse.json({ solutions, locked: false })
  }

  // 문제 출제자도 열람 가능
  const problem = await prisma.problem.findUnique({ where: { id: params.id }, select: { authorId: true } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = session?.user?.id === problem.authorId

  if (!isAuthor) {
    // 정답 맞힌 기록이 있어야 열람 가능
    if (!session?.user) return NextResponse.json({ solutions: [], locked: true })
    const correct = await prisma.problemSubmission.findFirst({
      where: { problemId: params.id, userId: session.user.id, correct: true },
    })
    if (!correct) return NextResponse.json({ solutions: [], locked: true })
  }

  const solutions = await prisma.problemSolution.findMany({
    where: { problemId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      _count: { select: { comments: true } },
    },
  })
  return NextResponse.json({ solutions, locked: false })
}


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const problem = await prisma.problem.findUnique({ where: { id: params.id } })
  if (!problem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 어드민·출제자 외에는 정답 맞힌 사람만 풀이 등록 가능
  const isAdmin = session.user.role === 'ADMIN'
  const isAuthor = session.user.id === problem.authorId
  if (!isAdmin && !isAuthor) {
    const correct = await prisma.problemSubmission.findFirst({
      where: { problemId: params.id, userId: session.user.id, correct: true },
    })
    if (!correct) return NextResponse.json({ error: '정답을 맞춰야 풀이를 등록할 수 있습니다' }, { status: 403 })
  }

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

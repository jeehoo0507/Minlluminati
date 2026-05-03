import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/problems/[id]/bookmark — 북마크 상태 조회
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ bookmarked: false })

  const existing = await prisma.problemBookmark.findUnique({
    where: { userId_problemId: { userId: session.user.id, problemId: params.id } },
  })
  return NextResponse.json({ bookmarked: !!existing })
}

// POST /api/problems/[id]/bookmark — 북마크 토글
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const problemId = params.id

  const existing = await prisma.problemBookmark.findUnique({
    where: { userId_problemId: { userId, problemId } },
  })

  if (existing) {
    await prisma.problemBookmark.delete({ where: { userId_problemId: { userId, problemId } } })
    return NextResponse.json({ bookmarked: false })
  } else {
    await prisma.problemBookmark.create({ data: { userId, problemId } })
    return NextResponse.json({ bookmarked: true })
  }
}

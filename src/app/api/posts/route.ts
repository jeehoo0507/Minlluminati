import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { getAuth } from '@/lib/auth'
import { awardPostPoints } from '@/lib/scoring'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')
  const unit = searchParams.get('unit')
  const search = searchParams.get('q')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where = {
    deletedAt: null,
    ...(subject ? { subject } : {}),
    ...(unit ? { unit } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search } },
            { content: { contains: search } },
          ],
        }
      : {}),
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        author: { select: { id: true, name: true, image: true, points: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.post.count({ where }),
  ])

  return NextResponse.json({ posts, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, subject, unit, type, imageUrls, fileUrls } = await req.json()

  if (!title?.trim() || !content?.trim() || !subject) {
    return NextResponse.json({ error: '제목, 내용, 과목은 필수입니다' }, { status: 400 })
  }

  const maxResult = await prisma.post.aggregate({ _max: { postNumber: true } })
  const nextNumber = (maxResult._max.postNumber ?? 0) + 1

  const post = await prisma.post.create({
    data: {
      postNumber: nextNumber,
      title: title.trim(),
      content: content.trim(),
      subject,
      unit: unit ?? null,
      type: type ?? 'PROBLEM',
      imageUrls: JSON.stringify(imageUrls ?? []),
      fileUrls: JSON.stringify(fileUrls ?? []),
      authorId: session.user.id,
    },
  })

  await awardPostPoints(session.user.id, post.id, subject)

  return NextResponse.json(post, { status: 201 })
}

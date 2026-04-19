import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { awardLikePoints, revokeLikePoints, POINTS } from '@/lib/scoring'

async function getLikePoints(): Promise<number> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: 'points' } })
  if (cfg) {
    const p = JSON.parse(cfg.value)
    return typeof p.likeReceived === 'number' ? p.likeReceived : POINTS.LIKE_RECEIVED
  }
  return POINTS.LIKE_RECEIVED
}

function resolvePostWhere(rawId: string) {
  return /^\d+$/.test(rawId)
    ? { postNumber: parseInt(rawId), deletedAt: null as null }
    : { id: rawId, deletedAt: null as null }
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.post.findFirst({
    where: resolvePostWhere(params.id),
    select: { id: true, authorId: true, subject: true },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.authorId === session.user.id) {
    return NextResponse.json({ error: '자신의 글에는 추천할 수 없습니다' }, { status: 400 })
  }

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: session.user.id, postId: post.id } },
  })

  const likePoints = await getLikePoints()

  if (existing) {
    await prisma.like.delete({
      where: { userId_postId: { userId: session.user.id, postId: post.id } },
    })
    await revokeLikePoints(post.authorId, post.id, post.subject, likePoints)
    const count = await prisma.like.count({ where: { postId: post.id } })
    return NextResponse.json({ liked: false, count, likePoints })
  } else {
    await prisma.like.create({
      data: { userId: session.user.id, postId: post.id },
    })
    await awardLikePoints(post.authorId, post.id, post.subject, likePoints)
    const count = await prisma.like.count({ where: { postId: post.id } })
    return NextResponse.json({ liked: true, count, likePoints })
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const post = await prisma.post.findFirst({
    where: resolvePostWhere(params.id),
    select: { id: true },
  })
  if (!post) return NextResponse.json({ liked: false, count: 0, likePoints: await getLikePoints() })

  const [count, likePoints] = await Promise.all([
    prisma.like.count({ where: { postId: post.id } }),
    getLikePoints(),
  ])
  const liked = session?.user
    ? !!(await prisma.like.findUnique({
        where: { userId_postId: { userId: session.user.id, postId: post.id } },
      }))
    : false
  return NextResponse.json({ liked, count, likePoints })
}

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

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.post.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { id: true, authorId: true, subject: true },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: session.user.id, postId: params.id } },
  })

  const likePoints = await getLikePoints()

  if (existing) {
    await prisma.like.delete({
      where: { userId_postId: { userId: session.user.id, postId: params.id } },
    })
    await revokeLikePoints(post.authorId, params.id, post.subject, likePoints)
    const count = await prisma.like.count({ where: { postId: params.id } })
    return NextResponse.json({ liked: false, count })
  } else {
    await prisma.like.create({
      data: { userId: session.user.id, postId: params.id },
    })
    await awardLikePoints(post.authorId, params.id, post.subject, likePoints)
    const count = await prisma.like.count({ where: { postId: params.id } })
    return NextResponse.json({ liked: true, count })
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const count = await prisma.like.count({ where: { postId: params.id } })
  const liked = session?.user
    ? !!(await prisma.like.findUnique({
        where: { userId_postId: { userId: session.user.id, postId: params.id } },
      }))
    : false
  return NextResponse.json({ liked, count })
}

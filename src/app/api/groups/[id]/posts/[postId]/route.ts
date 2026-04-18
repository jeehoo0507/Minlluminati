import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; postId: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.groupPost.findUnique({ where: { id: params.postId } })
  if (!post || post.groupId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = post.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  const isMod = await prisma.groupMember.findFirst({ where: { groupId: params.id, userId: session.user.id, role: 'ADMIN' } })
  if (!isAuthor && !isAdmin && !isMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.groupPost.delete({ where: { id: params.postId } })
  return NextResponse.json({ ok: true })
}

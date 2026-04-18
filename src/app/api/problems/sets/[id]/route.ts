import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  const userId = session?.user?.id

  const set = await prisma.problemSet.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, name: true, image: true, points: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          problem: {
            include: {
              author: { select: { id: true, name: true, image: true, points: true } },
              _count: { select: { submissions: true } },
            },
          },
        },
      },
    },
  })

  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check access: public or owner
  if (!set.isPublic && set.authorId !== userId && session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(set)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await prisma.problemSet.findUnique({ where: { id: params.id } })
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = set.authorId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.problemSet.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

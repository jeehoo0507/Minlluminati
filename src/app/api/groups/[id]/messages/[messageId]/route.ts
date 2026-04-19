import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const msg = await prisma.groupMessage.findUnique({ where: { id: params.messageId } })
  if (!msg || msg.groupId !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isAdmin = session.user.role === 'ADMIN'
  if (msg.authorId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.groupMessage.update({
    where: { id: params.messageId },
    data: { deletedAt: new Date(), content: '' },
  })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH: 세션 제목 변경
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const aiSession = await prisma.aiSession.findUnique({ where: { id: params.id } })
  if (!aiSession || aiSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { title } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 })

  const updated = await prisma.aiSession.update({
    where: { id: params.id },
    data: { title: title.trim().slice(0, 60) },
  })
  return NextResponse.json(updated)
}

// DELETE: 세션 삭제 (메시지 포함 cascade)
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const aiSession = await prisma.aiSession.findUnique({ where: { id: params.id } })
  if (!aiSession || aiSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.aiSession.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

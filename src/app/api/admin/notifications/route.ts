import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  await requireAdmin()
  const { title, content, link } = await req.json()
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요' }, { status: 400 })
  }

  const users = await prisma.user.findMany({ select: { id: true } })
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: 'ADMIN_NOTICE',
      title: title.trim(),
      content: content.trim(),
      link: link?.trim() || null,
    })),
  })
  return NextResponse.json({ ok: true, count: users.length })
}

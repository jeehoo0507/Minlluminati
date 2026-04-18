import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const requests = await prisma.permissionRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(requests)
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, action } = await req.json()
  const request = await prisma.permissionRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'approve') {
    await prisma.$transaction([
      prisma.allowedEmail.upsert({
        where: { email: request.email },
        create: { email: request.email },
        update: {},
      }),
      prisma.permissionRequest.update({ where: { id }, data: { status: 'APPROVED' } }),
    ])
  } else {
    await prisma.permissionRequest.update({ where: { id }, data: { status: 'REJECTED' } })
  }

  return NextResponse.json({ ok: true })
}

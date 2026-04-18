import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, image: true, points: true, role: true, _count: { select: { posts: true } } },
    orderBy: { points: 'desc' },
    take: 50,
  })
  return NextResponse.json(users)
}

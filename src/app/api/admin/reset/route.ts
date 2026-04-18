import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { adminPassword, scope } = await req.json()
  // scope: 'points' | 'all'
  if (!adminPassword) return NextResponse.json({ error: '비밀번호를 입력해주세요' }, { status: 400 })

  const admin = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!admin?.password) return NextResponse.json({ error: '비밀번호가 설정되지 않았습니다' }, { status: 400 })
  const valid = await bcrypt.compare(adminPassword, admin.password)
  if (!valid) return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다' }, { status: 401 })

  if (scope === 'points') {
    // Reset all points and point history only
    await prisma.$transaction([
      prisma.pointHistory.deleteMany({}),
      prisma.user.updateMany({ data: { points: 0 } }),
      prisma.post.updateMany({ data: { pointsAwarded: 0 } }),
    ])
  } else if (scope === 'all') {
    // Reset everything: points, posts, comments, likes
    await prisma.$transaction([
      prisma.pointHistory.deleteMany({}),
      prisma.solutionComment.deleteMany({}),
      prisma.problemSolution.deleteMany({}),
      prisma.problemSubmission.deleteMany({}),
      prisma.contestSubmission.deleteMany({}),
      prisma.like.deleteMany({}),
      prisma.comment.deleteMany({}),
      prisma.post.updateMany({ data: { deletedAt: new Date(), pointsAwarded: 0 } }),
      prisma.user.updateMany({ data: { points: 0 } }),
    ])
  }

  return NextResponse.json({ ok: true })
}

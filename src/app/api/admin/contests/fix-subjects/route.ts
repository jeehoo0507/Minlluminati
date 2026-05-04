import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// 기존 대회에서 이전된 문제들의 subject를 'CONTEST'로 일괄 업데이트
export async function POST() {
  const session = await getAuth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await prisma.problem.updateMany({
    where: { contestId: { not: null }, subject: { not: 'CONTEST' } },
    data: { subject: 'CONTEST' },
  })

  return NextResponse.json({ ok: true, updated: result.count })
}

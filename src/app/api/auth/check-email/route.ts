import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 이메일 상태 확인: 'not_allowed' | 'needs_setup' | 'exists'
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ status: 'not_allowed' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) return NextResponse.json({ status: 'exists' })

  const allowed = await prisma.allowedEmail.findUnique({ where: { email } })
  if (allowed) return NextResponse.json({ status: 'needs_setup' })

  return NextResponse.json({ status: 'not_allowed' })
}

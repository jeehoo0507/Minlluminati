import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const submissions = await prisma.problemSubmission.findMany({
    where: { problemId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, image: true, points: true } },
    },
  })

  return NextResponse.json({ submissions })
}

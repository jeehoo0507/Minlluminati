import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ canCreate: false })

  if (session.user.role === 'ADMIN') return NextResponse.json({ canCreate: true })

  const organizer = await prisma.contestOrganizer.findUnique({
    where: { userId: session.user.id },
  })
  return NextResponse.json({ canCreate: !!organizer })
}

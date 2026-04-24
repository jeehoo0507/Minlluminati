import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// DELETE: disband team (leader only)
export async function DELETE(_: NextRequest, { params }: { params: { id: string; teamId: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const team = await prisma.contestTeam.findUnique({ where: { id: params.teamId } })
  if (!team || team.contestId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (team.leaderId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.contestTeam.delete({ where: { id: params.teamId } })
  return NextResponse.json({ ok: true })
}

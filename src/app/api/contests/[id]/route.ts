import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function autoEndIfExpired(id: string) {
  const c = await prisma.contest.findUnique({ where: { id } })
  if (!c || c.status !== 'ONGOING' || !c.startTime) return
  const elapsed = Date.now() - new Date(c.startTime).getTime()
  if (elapsed >= c.durationMin * 60 * 1000) {
    await prisma.contest.update({ where: { id }, data: { status: 'ENDED' } })
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  await autoEndIfExpired(params.id)
  const session = await getAuth()

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: {
      organizer: { select: { id: true, name: true, image: true, points: true } },
      problems: { orderBy: { order: 'asc' } },
      _count: { select: { participants: true } },
    },
  })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session?.user?.id === contest.organizerId
  const isAdmin = session?.user?.role === 'ADMIN'

  // DRAFT/PENDING: organizer/admin only
  if (['DRAFT', 'PENDING'].includes(contest.status) && !isOrganizer && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Hide answers from non-organizers
  const problems = (isOrganizer || isAdmin)
    ? contest.problems
    : contest.problems.map(({ answer: _a, ...p }) => p)

  // My participation & submissions
  let myParticipant = null
  let mySubmissions: Record<string, boolean> = {}
  if (session?.user) {
    myParticipant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
    })
    if (myParticipant) {
      const subs = await prisma.contestSubmission.findMany({
        where: { userId: session.user.id, problem: { contestId: params.id } },
      })
      mySubmissions = Object.fromEntries(subs.map((s) => [s.problemId, s.correct]))
    }
  }

  return NextResponse.json({ ...contest, problems, myParticipant, mySubmissions })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({ where: { id: params.id } })
  if (!contest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOrganizer = session.user.id === contest.organizerId
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOrganizer && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await req.json()
  const updated = await prisma.contest.update({
    where: { id: params.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  })
  return NextResponse.json(updated)
}

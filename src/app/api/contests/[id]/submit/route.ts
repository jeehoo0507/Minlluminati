import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: { contributors: { select: { userId: true } } },
  })
  if (!contest || contest.status !== 'ONGOING') {
    return NextResponse.json({ error: '진행 중인 대회가 아닙니다' }, { status: 400 })
  }

  // 출제자/검토자인지 확인 (참여는 가능하나 점수 반영 제외)
  const isContributor = contest.contributors.some((c) => c.userId === session.user.id)
  const isOrganizer = contest.organizerId === session.user.id

  // Check time
  if (contest.startTime) {
    const elapsed = Date.now() - new Date(contest.startTime).getTime()
    if (elapsed >= contest.durationMin * 60 * 1000) {
      await prisma.contest.update({ where: { id: params.id }, data: { status: 'ENDED' } })
      return NextResponse.json({ error: '대회가 종료되었습니다' }, { status: 400 })
    }
  }

  const participant = await prisma.contestParticipant.findUnique({
    where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
  })
  if (!participant) return NextResponse.json({ error: '먼저 대회에 참가하세요' }, { status: 400 })

  const { problemId, answer, parts } = await req.json()
  if (!problemId) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })

  const problem = await prisma.contestProblem.findUnique({ where: { id: problemId } })
  if (!problem || problem.contestId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if already correctly solved or retry not allowed
  const existing = await prisma.contestSubmission.findUnique({
    where: { problemId_userId: { problemId, userId: session.user.id } },
  })
  if (existing?.correct) return NextResponse.json({ correct: true, alreadySolved: true })
  if (!problem.allowRetry && existing) {
    return NextResponse.json({ error: '이 문제는 재시도가 불가능합니다', noRetry: true }, { status: 400 })
  }

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')

  // Parse subAnswers
  const subAnswerDefs: { label: string; answer: string; extra?: string[] }[] = (() => {
    try { return JSON.parse(problem.subAnswers ?? '[]') } catch { return [] }
  })()

  let correct: boolean
  let storedAnswer: string

  // 방어적 체크: answer === '[multi-part]' 이면서 subAnswerDefs가 비어있으면 multi-part 사용
  const effectiveMultiPart = subAnswerDefs.length > 0 || problem.answer === '[multi-part]'

  if (effectiveMultiPart && subAnswerDefs.length > 0) {
    // Multi-part mode
    if (!Array.isArray(parts) || parts.length !== subAnswerDefs.length) {
      return NextResponse.json({ error: '답변 개수가 맞지 않습니다' }, { status: 400 })
    }
    correct = subAnswerDefs.every((def, i) => {
      const submitted = normalize(parts[i] ?? '')
      const allValid = [def.answer, ...(def.extra ?? [])].map(normalize)
      return allValid.some((a) => a === submitted)
    })
    storedAnswer = JSON.stringify(parts)
  } else if (problem.answer === '[multi-part]' && subAnswerDefs.length === 0) {
    // 문제 설정 오류: 서술형이거나 잘못된 설정
    return NextResponse.json({ error: '문제 설정에 오류가 있습니다. 주최자에게 문의하세요' }, { status: 400 })
  } else {
    // Single mode
    if (!answer) return NextResponse.json({ error: '답을 입력해주세요' }, { status: 400 })
    const normalizedAnswer = normalize(answer)
    const correctAnswer = normalize(problem.answer)
    let extraAnswers: string[] = []
    try { extraAnswers = JSON.parse(problem.extraAnswers) } catch {}
    const allAnswers = [correctAnswer, ...extraAnswers.map(normalize)]
    correct = allAnswers.some((a) => a === normalizedAnswer)
    storedAnswer = answer
  }

  // 출제자·주최자는 리더보드 점수에 반영하지 않음
  const scoreBlocked = isContributor || isOrganizer

  // Use transaction to prevent race conditions on concurrent submissions
  await prisma.$transaction(async (tx) => {
    // Double-check no correct submission was inserted since we last checked
    const latest = await tx.contestSubmission.findUnique({
      where: { problemId_userId: { problemId, userId: session.user.id } },
    })
    if (latest?.correct) return // Already correctly solved, do nothing

    await tx.contestSubmission.upsert({
      where: { problemId_userId: { problemId, userId: session.user.id } },
      create: { problemId, userId: session.user.id, answer: storedAnswer, correct },
      update: { answer: storedAnswer, correct },
    })

    if (correct && !scoreBlocked) {
      // Only increment if this is a newly correct submission
      if (!latest?.correct) {
        await tx.contestParticipant.update({
          where: { contestId_userId: { contestId: params.id, userId: session.user.id } },
          data: { score: { increment: problem.points } },
        })
        // If team contest, update team score too
        if (contest.teamContest) {
          await tx.contestTeam.updateMany({
            where: { contestId: params.id, members: { some: { userId: session.user.id } } },
            data: { score: { increment: problem.points } },
          })
        }
      }
    }
  })

  return NextResponse.json({ correct, scoreBlocked: correct && scoreBlocked, multiPart: subAnswerDefs.length > 0 })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuth } from '@/lib/auth'
import { tryAcquireSlot, releaseSlot, getActiveCount, getMaxConcurrent } from '@/lib/aiConcurrency'
import { searchPlatformContext, SearchTarget } from '@/lib/aiPlatformSearch'

export const dynamic = 'force-dynamic'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b'

const SYSTEM_PROMPT = `당신은 수학·과학 튜터입니다. 반드시 한국어로만 답변하세요.

[절대 규칙]
- 이모지, 이모티콘 사용 금지.
- "물론이죠", "네!", "좋아요" 같은 감탄사로 시작하지 마세요.
- 수식은 반드시 LaTeX($...$, $$...$$)로만 쓰세요. 같은 수식을 평문으로 절대 반복하지 마세요.
  - 잘못된 예: $A^{-1}$A−1 또는 $2 \\times 2$2×2 (LaTeX 뒤에 평문 반복 금지)
  - 올바른 예: $A^{-1}$ 또는 $2 \\times 2$
- 분수는 \\frac{}{} 사용. 슬래시(/) 사용 금지.

[플랫폼 참고 자료 규칙]
- [플랫폼 참고 자료]가 제공되면 해당 자료를 언급하고 링크를 포함하세요.
- 링크([바로가기](...))는 반드시 마크다운 그대로 출력하세요. "(URL 정보 없음)"으로 대체 금지.
- 참고 자료가 있어도 수학·과학 지식으로 직접 풀이·설명을 제공하세요. 자료 나열에만 그치지 마세요.

[표]
- 반드시 헤더 구분선(|---|---|)을 포함하세요.
- 표 안 수식도 $...$ 로 감싸세요.

[풀이]
- **1단계**, **2단계** 형식으로 구분하세요.
- 마지막에 **최종 답:** 으로 정리하세요.
- 핵심 용어와 중요 결과는 **굵게** 표시하세요.`

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // AI 비활성화 여부 + 구독 확인
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { aiDisabled: true } })
  if (user?.aiDisabled) {
    return NextResponse.json({ error: '관리자에 의해 AI 기능이 비활성화되었습니다' }, { status: 403 })
  }
  const sub = await prisma.aiSubscription.findUnique({ where: { userId: session.user.id } })
  if (!sub || sub.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'AI 구독이 필요합니다' }, { status: 403 })
  }

  let body: { message: string; images?: string[]; sessionId: string; searchTarget?: SearchTarget }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { message, images = [], sessionId, searchTarget = false } = body
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  if (!message?.trim() && images.length === 0) {
    return NextResponse.json({ error: '메시지를 입력해주세요' }, { status: 400 })
  }

  // 세션 소유권 확인
  const aiSession = await prisma.aiSession.findUnique({ where: { id: sessionId } })
  if (!aiSession || aiSession.userId !== session.user.id) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
  }

  // ── GPU 동시 접속 제한 ──────────────────────────────────────────
  if (!tryAcquireSlot()) {
    return NextResponse.json(
      {
        error: `현재 AI를 사용 중인 인원이 많습니다 (${getActiveCount()}/${getMaxConcurrent()}명). 잠시 후 다시 시도해주세요.`,
        busy: true,
      },
      { status: 503 },
    )
  }

  // 슬롯 이중 해제 방지용 플래그
  let slotReleased = false
  function safeRelease() {
    if (!slotReleased) {
      slotReleased = true
      releaseSlot()
    }
  }

  // 최근 대화 컨텍스트 (최근 20개)
  const history = await prisma.aiMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  history.reverse()

  // 유저 메시지 저장
  const userMsg = await prisma.aiMessage.create({
    data: {
      userId: session.user.id,
      sessionId,
      role: 'user',
      content: message.trim(),
      imageUrls: JSON.stringify(images),
    },
  })

  // 첫 메시지면 세션 제목 자동 설정
  if (history.length === 0) {
    const autoTitle = message.trim().slice(0, 40) + (message.trim().length > 40 ? '…' : '')
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { title: autoTitle, updatedAt: new Date() },
    }).catch(() => {})
  } else {
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    }).catch(() => {})
  }

  // 플랫폼 DB 검색 (문제 번호 참조, 키워드 검색)
  const platformCtx = await searchPlatformContext(message.trim(), searchTarget)

  // Ollama messages 구성
  const ollamaMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => {
      const imgs: string[] = JSON.parse(m.imageUrls)
      const cleanImages = imgs.map((img) => (img.startsWith('data:') ? img.split(',')[1] : img))
      return {
        role: m.role,
        content: m.content,
        ...(cleanImages.length > 0 ? { images: cleanImages } : {}),
      }
    }),
    {
      role: 'user',
      content: platformCtx.hasResults
        ? (
          `[플랫폼 참고 자료]\n` +
          `아래는 양현재+ 플랫폼 DB에서 검색된 관련 자료입니다. 참고용으로만 사용하고, 수학·과학 지식으로 직접 풀이·설명하세요.\n` +
          `링크([바로가기](...))는 반드시 그대로 마크다운으로 출력하세요.\n\n` +
          `${platformCtx.text}\n\n` +
          `[질문]: ${message.trim()}`
        )
        : message.trim(),
      // 유저가 직접 첨부한 이미지 + 문제 이미지(RAG) 합쳐서 전달
      ...(([ ...images, ...platformCtx.images ].length > 0)
        ? {
            images: [...images, ...platformCtx.images].map((img) =>
              img.startsWith('data:') ? img.split(',')[1] : img
            ),
          }
        : {}),
    },
  ]

  // AbortController — 클라이언트 연결 끊기면 Ollama 추론도 중단
  const abort = new AbortController()

  // Ollama 스트리밍 요청
  let ollamaRes: Response
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: ollamaMessages, stream: true }),
      signal: abort.signal,
    })
  } catch {
    safeRelease()
    await prisma.aiMessage.delete({ where: { id: userMsg.id } }).catch(() => {})
    return NextResponse.json(
      { error: 'AI 서버에 연결할 수 없습니다. Ollama가 실행 중인지 확인해주세요.' },
      { status: 503 },
    )
  }

  if (!ollamaRes.ok) {
    safeRelease()
    await prisma.aiMessage.delete({ where: { id: userMsg.id } }).catch(() => {})
    return NextResponse.json({ error: `AI 오류: ${ollamaRes.status}` }, { status: 502 })
  }

  const encoder = new TextEncoder()
  let fullContent = ''
  const reader = ollamaRes.body!.getReader()

  const stream = new ReadableStream({
    async start(controller) {
      const dec = new TextDecoder()
      // 검색이 실행됐지만 결과 없을 때 프론트에 알림
      if (platformCtx.searchRan && !platformCtx.hasResults) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ searchEmpty: true })}\n\n`))
      }
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = dec.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(Boolean)

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line)
              const token: string = parsed?.message?.content ?? ''
              if (token) {
                fullContent += token
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
              }
              if (parsed?.done) {
                // 어시스턴트 응답 DB 저장
                await prisma.aiMessage.create({
                  data: {
                    userId: session.user.id,
                    sessionId,
                    role: 'assistant',
                    content: fullContent,
                    imageUrls: '[]',
                  },
                }).catch(() => {})
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
              }
            } catch { /* JSON 파싱 실패 무시 */ }
          }
        }
      } catch (e: unknown) {
        // AbortError는 정상 취소이므로 에러 전송 안 함
        const isAbort = e instanceof Error && e.name === 'AbortError'
        if (!isAbort) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '스트리밍 오류' })}\n\n`))
        }
      } finally {
        safeRelease() // 슬롯 반환 (정상 완료 경로)
        controller.close()
      }
    },

    // 클라이언트가 연결을 끊으면 호출됨
    cancel() {
      abort.abort()   // Ollama 추론 중단 → GPU 즉시 해제
      safeRelease()   // 슬롯 반환 (이중 해제 방지됨)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

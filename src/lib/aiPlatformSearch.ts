import { prisma } from './db'
import { readFile } from 'fs/promises'
import path from 'path'

export interface PlatformContext {
  text: string
  images: string[]
  hasResults: boolean
  searchRan: boolean
}

export type SearchTarget = 'problem' | 'post' | 'both' | false

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'gemma3:4b'

// ── 이미지 → base64 ────────────────────────────────────────────────
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const filename = url.split('/').pop()
    if (!filename || filename.includes('..')) return null
    const filepath = path.join(process.cwd(), 'public', 'uploads', filename)
    const buf = await readFile(filepath)
    return buf.toString('base64')
  } catch {
    return null
  }
}

// ── 문제 번호 추출 ─────────────────────────────────────────────────
function extractProblemNumbers(message: string): number[] {
  const patterns = [
    /#(\d+)/g,
    /문제\s*(\d+)\s*번?/g,
    /(\d+)\s*번\s*(?:문제|문항)?/g,
  ]
  const numbers = new Set<number>()
  for (const pat of patterns) {
    let m
    while ((m = pat.exec(message)) !== null) {
      const n = parseInt(m[1])
      if (n > 0 && n < 100000) numbers.add(n)
    }
  }
  return Array.from(numbers).slice(0, 5)
}

// ── 불용어 ────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  '관련','있나','있어','찾아줘','찾아','검색','알려줘','추천','뭐가','어떤',
  '올라온','있는지','보여줘','목록','알려','가르쳐','줘',
  '혹은','또는','및','그리고','하고','이나','아니면','하지만','그러나','즉','또',
  '이','가','은','는','을','를','의','에','에서','으로','로','도','와','과',
  '이랑','랑','에게','한테','부터','까지','만','마다',
  '아니','이제','그럼','그냥','혹시','근데','진짜','정말','좀','더','다시',
  '문제','피드','글','포스트','문항','탭','사이트','플랫폼',
  '양현재','민루미나티','내에서','안에서','번호','요','부탁',
])

// ── 기본 키워드 추출 ───────────────────────────────────────────────
function extractBaseKeywords(message: string): string[] {
  return message
    .replace(/관련|관한|관해/g, ' ')
    .replace(/중에서?|에서|에게|으로서?|이랑|하고/g, ' ')
    .replace(/[#?!.,~\-+]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 4)
}

// ── LLM으로 관련 키워드 확장 (5초 타임아웃) ──────────────────────
async function expandWithLLM(keywords: string[]): Promise<string[]> {
  if (keywords.length === 0) return []
  const query = keywords.join(', ')
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt:
          `다음 검색어와 관련된 수학·과학 한국어 단어 5개를 쉼표로만 구분해서 출력하세요.\n` +
          `단어만 출력하고 설명, 번호, 기호는 절대 쓰지 마세요.\n` +
          `검색어: ${query}\n출력:`,
        stream: false,
        options: { num_predict: 40, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return keywords

    const data = await res.json()
    const text: string = data.response ?? ''
    const expanded = text
      .split(/[,，、\n·•\-]/)
      .map((k) => k.trim().replace(/^\d+[.)]\s*/, '').replace(/[^가-힣a-zA-Z0-9]/g, ''))
      .filter((k) => k.length >= 2 && !STOP_WORDS.has(k))
      .slice(0, 5)

    const merged = Array.from(new Set([...keywords, ...expanded]))
    console.log('[RAG] LLM 확장:', keywords, '→', merged)
    return merged
  } catch {
    console.log('[RAG] LLM 확장 실패, 원본 사용:', keywords)
    return keywords
  }
}

// ── 메인 검색 함수 ─────────────────────────────────────────────────
export async function searchPlatformContext(
  message: string,
  searchTarget: SearchTarget = false,
): Promise<PlatformContext> {
  const sections: string[] = []
  const b64Images: string[] = []
  let searchRan = false

  // ① 문제 번호 직접 조회
  const numbers = extractProblemNumbers(message)
  if (numbers.length > 0) {
    const problems = await prisma.problem.findMany({
      where: { problemNumber: { in: numbers }, status: 'APPROVED' },
      select: {
        id: true, problemNumber: true, title: true, content: true,
        answer: true, subAnswers: true, extraAnswers: true,
        subject: true, approvedPts: true, isEssay: true, imageUrls: true,
      },
      orderBy: { problemNumber: 'asc' },
    })

    for (const p of problems) {
      const answerText = p.isEssay
        ? '[서술형]'
        : (() => {
            const subs: { label: string; answer: string }[] = (() => {
              try { return JSON.parse(p.subAnswers) } catch { return [] }
            })()
            const extras: string[] = (() => {
              try { return JSON.parse(p.extraAnswers) } catch { return [] }
            })()
            if (subs.length > 0) return subs.map((s) => `${s.label}: ${s.answer}`).join(' / ')
            return extras.length > 0 ? `${p.answer} (혹은: ${extras.join(', ')})` : p.answer
          })()

      const urls: string[] = (() => { try { return JSON.parse(p.imageUrls) } catch { return [] } })()
      const validImgs = (await Promise.all(urls.map(imageUrlToBase64))).filter((x): x is string => x !== null)
      b64Images.push(...validImgs)

      sections.push(
        `문제 #${p.problemNumber} "${p.title}"\n` +
        `과목: ${p.subject ?? '없음'} | ${p.approvedPts ?? '?'}점` +
        (validImgs.length > 0 ? ` | 이미지 ${validImgs.length}개 포함` : '') + '\n' +
        `내용: ${p.content.slice(0, 800)}${p.content.length > 800 ? '…' : ''}\n` +
        `정답: ${answerText}\n` +
        `링크: [문제 #${p.problemNumber} 바로가기](/problems/${p.id})`
      )
    }

    const foundNums = new Set(problems.map((p) => p.problemNumber))
    for (const n of numbers) {
      if (!foundNums.has(n))
        sections.push(`문제 #${n}: 존재하지 않거나 승인되지 않은 문제입니다.`)
    }
  }

  // ② 키워드 검색 — 버튼 클릭 시에만 동작
  const doSearch = searchTarget !== false
  const wantProblems = doSearch && (searchTarget === 'problem' || searchTarget === 'both')
  const wantPosts    = doSearch && (searchTarget === 'post'    || searchTarget === 'both')

  if (doSearch) {
    searchRan = true
    const base     = extractBaseKeywords(message)
    const allTerms = await expandWithLLM(base)

    if (allTerms.length > 0) {
      type ProbWhere = { title?: { contains: string }; content?: { contains: string }; subject?: { contains: string } }
      type PostWhere = { title?: { contains: string }; content?: { contains: string }; subject?: { contains: string } }

      const probOR: ProbWhere[] = allTerms.flatMap((t) => [
        { title:   { contains: t } },
        { content: { contains: t } },
        { subject: { contains: t } },
      ])
      const postOR: PostWhere[] = allTerms.flatMap((t) => [
        { title:   { contains: t } },
        { content: { contains: t } },
      ])

      const [problems, posts] = await Promise.all([
        wantProblems
          ? prisma.problem.findMany({
              where: { status: 'APPROVED', OR: probOR },
              select: { id: true, problemNumber: true, title: true, subject: true, approvedPts: true },
              orderBy: { problemNumber: 'asc' },
              take: 12,
            })
          : Promise.resolve([] as { id: string; problemNumber: number; title: string; subject: string | null; approvedPts: number | null }[]),
        wantPosts
          ? prisma.post.findMany({
              where: { deletedAt: null, OR: postOR },
              select: { id: true, title: true, subject: true },
              orderBy: { createdAt: 'desc' },
              take: 8,
            })
          : Promise.resolve([] as { id: string; title: string; subject: string | null }[]),
      ])

      console.log('[RAG] 결과 → 문제:', problems.length, '피드:', posts.length)

      if (problems.length > 0) {
        const label = base.length > 0 ? `"${base.join(', ')}"` : '검색'
        sections.push(
          `${label} 관련 문제 ${problems.length}개:\n` +
          problems.map((p) =>
            `- #${p.problemNumber} "${p.title}" (${p.subject ?? ''}, ${p.approvedPts ?? '?'}점) → [바로가기](/problems/${p.id})`
          ).join('\n')
        )
      }

      if (posts.length > 0) {
        const label = base.length > 0 ? `"${base.join(', ')}"` : '검색'
        sections.push(
          `${label} 관련 피드 글 ${posts.length}개:\n` +
          posts.map((p) => `- "${p.title}" (${p.subject ?? ''}) → [바로가기](/post/${p.id})`).join('\n')
        )
      }
    }
  }

  if (sections.length === 0) {
    return { text: '', images: [], hasResults: false, searchRan }
  }

  return {
    text: sections.join('\n\n'),
    images: b64Images,
    hasResults: true,
    searchRan,
  }
}

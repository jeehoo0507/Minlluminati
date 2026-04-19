import { getAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PostEditor } from '@/components/post/PostEditor'
import { SUBJECTS, type SubjectKey } from '@/lib/utils'

// Map subject keys that double as post types
const SUBJECT_TYPE_MAP: Record<string, string> = {
  QUESTION: 'QUESTION',
  FREE: 'FREE',
  BOARD: 'FREE',
  PROOF: 'PROBLEM',
  TIPS: 'FREE',
}

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: { subject?: string; type?: string }
}) {
  const session = await getAuth()
  if (!session?.user) redirect('/login?callbackUrl=/post/new')

  const rawSubject = searchParams.subject?.toUpperCase()
  const initialSubject: SubjectKey | undefined =
    rawSubject && rawSubject in SUBJECTS ? (rawSubject as SubjectKey) : undefined

  const rawType = searchParams.type?.toUpperCase()
  const validTypes = ['PROBLEM', 'SOLUTION', 'QUESTION', 'FREE']
  const initialType: string | undefined =
    rawType && validTypes.includes(rawType)
      ? rawType
      : initialSubject && SUBJECT_TYPE_MAP[initialSubject]
        ? SUBJECT_TYPE_MAP[initialSubject]
        : undefined

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">새 글 작성</h1>
        <p className="text-sm text-text-secondary mt-1">문제, 풀이, 질문을 공유해보세요 · 추천받을 때 포인트 획득</p>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-6">
        <PostEditor initialSubject={initialSubject} initialType={initialType} />
      </div>
    </div>
  )
}

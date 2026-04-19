import { getAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PostEditor } from '@/components/post/PostEditor'

export default async function NewPostPage() {
  const session = await getAuth()
  if (!session?.user) redirect('/login?callbackUrl=/post/new')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">새 글 작성</h1>
        <p className="text-sm text-text-secondary mt-1">문제, 풀이, 질문을 공유해보세요 · 추천받을 때 포인트 획득</p>
      </div>
      <div className="bg-surface border border-border rounded-2xl p-6">
        <PostEditor />
      </div>
    </div>
  )
}

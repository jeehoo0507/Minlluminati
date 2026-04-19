'use client'
import Link from 'next/link'

export default function PostError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
      <p className="text-text-secondary">게시글을 불러오는 중 오류가 발생했습니다</p>
      {error.message && (
        <p className="text-xs text-muted font-mono bg-surface border border-border rounded-lg px-3 py-2 inline-block">
          {error.message}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <button onClick={reset} className="text-accent text-sm hover:underline">다시 시도</button>
        <Link href="/feed" className="text-text-secondary text-sm hover:underline">피드로</Link>
      </div>
    </div>
  )
}

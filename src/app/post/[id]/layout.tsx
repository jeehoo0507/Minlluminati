import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/posts/${params.id}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Min(joon)lluminati' }

    const post = await res.json()
    if (!post?.title) return { title: 'Min(joon)lluminati' }

    const description = (post.content ?? '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '[수식]')
      .replace(/\$[^$]*\$/g, '[수식]')
      .replace(/[#*`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160)

    const numberPrefix = post.postNumber ? `#${post.postNumber} ` : ''
    const title = `${numberPrefix}${post.title} — ${post.author?.name ?? '익명'}`

    return {
      title,
      description,
      openGraph: { title, description, type: 'article', siteName: 'Min(joon)lluminati' },
      twitter: { card: 'summary', title, description },
    }
  } catch {
    return { title: 'Min(joon)lluminati' }
  }
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

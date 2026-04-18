'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { cn } from '@/lib/utils'
import { LogOut, Shield, Trophy, PenLine } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [dropOpen, setDropOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-accent font-bold text-lg tracking-tight">Min(joon)</span>
          <span className="text-text-primary font-bold text-lg tracking-tight">lluminati</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { href: '/feed', label: '피드' },
            { href: '/subjects', label: '과목별' },
            { href: '/leaderboard', label: '랭킹' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'text-accent bg-accent/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <Link
                href="/post/new"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
              >
                <PenLine size={14} />
                글쓰기
              </Link>
              <div className="relative">
                <button
                  onClick={() => setDropOpen(!dropOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <Avatar name={session.user.name} image={session.user.image} size={28} />
                  <TierBadge points={session.user.points ?? 0} />
                </button>
                {dropOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-20 py-1 animate-fade-in">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-sm font-semibold text-text-primary truncate">{session.user.name}</p>
                        <p className="text-xs text-text-secondary truncate">{session.user.email}</p>
                      </div>
                      {session.user.role === 'ADMIN' && (
                        <Link
                          href="/admin"
                          onClick={() => setDropOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                        >
                          <Shield size={14} />
                          관리자 패널
                        </Link>
                      )}
                      <Link
                        href="/leaderboard"
                        onClick={() => setDropOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                      >
                        <Trophy size={14} />
                        내 랭킹 확인
                      </Link>
                      <button
                        onClick={() => { setDropOpen(false); signOut() }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-red-400 hover:bg-surface-2 transition-colors"
                      >
                        <LogOut size={14} />
                        로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

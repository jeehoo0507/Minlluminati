'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { TierBadge } from '@/components/ui/TierBadge'
import { cn } from '@/lib/utils'
import { LogOut, Shield, Trophy, PenLine, User, Menu, X, Bell } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface Notif { id: string; type: string; title: string; content: string; link?: string | null; read: boolean; createdAt: string }

const NAV_ITEMS = [
  { href: '/feed', label: '피드' },
  { href: '/subjects', label: '과목별' },
  { href: '/problems', label: '문제' },
  { href: '/leaderboard', label: '랭킹' },
  { href: '/contests', label: '대회' },
  { href: '/groups', label: '그룹' },
  { href: '/timer', label: '타이머' },
]

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [dropOpen, setDropOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notif[]>([])
  const unread = notifications.filter((n) => !n.read).length

  const loadNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (res.ok) setNotifications(await res.json())
  }, [])

  useEffect(() => {
    if (session?.user) {
      loadNotifications()
      const iv = setInterval(loadNotifications, 60000)
      return () => clearInterval(iv)
    }
  }, [session, loadNotifications])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    setNotifications((p) => p.map((n) => ({ ...n, read: true })))
  }

  async function markRead(id: string, link?: string | null) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, read: true } : n))
    setBellOpen(false)
    if (link) router.push(link)
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group shrink-0">
            <span className="text-text-primary font-bold text-lg tracking-tight">yang</span>
            <span className="text-accent font-bold text-lg tracking-tight">now</span>
            <span className="text-accent font-black text-xl tracking-tight">+</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
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
            <ThemeToggle />

            {session?.user ? (
              <>
                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) loadNotifications() }}
                    className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-2 transition-colors"
                  >
                    <Bell size={18} className="text-text-secondary" />
                    {unread > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                  {bellOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
                      <div className="fixed top-14 right-2 w-80 max-w-[calc(100vw-1rem)] md:absolute md:top-full md:right-0 md:mt-1 md:max-w-none bg-surface border border-border rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                          <span className="text-sm font-semibold text-text-primary">알림</span>
                          {unread > 0 && <button onClick={markAllRead} className="text-xs text-accent hover:underline">모두 읽음</button>}
                        </div>
                        <div className="overflow-y-auto max-h-80">
                          {notifications.length === 0 ? (
                            <div className="text-center py-8 text-text-secondary text-sm">알림이 없습니다</div>
                          ) : (
                            notifications.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => markRead(n.id, n.link)}
                                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 transition-colors ${!n.read ? 'bg-accent/5' : ''}`}
                              >
                                <div className="flex items-start gap-2">
                                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />}
                                  <div className={!n.read ? '' : 'pl-3.5'}>
                                    <p className="text-xs font-semibold text-text-primary">{n.title}</p>
                                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.content}</p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <Link
                  href="/post/new"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors"
                >
                  <PenLine size={14} />
                  글쓰기
                </Link>

                {/* Profile dropdown */}
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
                      <div className="fixed top-14 right-2 w-48 md:absolute md:top-full md:right-0 md:mt-1 bg-surface border border-border rounded-xl shadow-2xl z-20 py-1 animate-fade-in">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-sm font-semibold text-text-primary truncate">{session.user.name}</p>
                          <p className="text-xs text-text-secondary truncate">{session.user.email}</p>
                        </div>
                        {session.user.role === 'ADMIN' && (
                          <Link href="/admin" onClick={() => setDropOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
                            <Shield size={14} /> 관리자 패널
                          </Link>
                        )}
                        <Link href="/profile" onClick={() => setDropOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
                          <User size={14} /> 프로필 설정
                        </Link>
                        <Link href="/leaderboard" onClick={() => setDropOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
                          <Trophy size={14} /> 내 랭킹 확인
                        </Link>
                        <button onClick={() => { setDropOpen(false); signOut() }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-red-400 hover:bg-surface-2 transition-colors">
                          <LogOut size={14} /> 로그아웃
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login"
                className="px-3 py-1.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-dim transition-colors">
                로그인
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-2 transition-colors"
              aria-label="메뉴 열기"
            >
              <Menu size={20} className="text-text-primary" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed top-0 right-0 z-50 h-full w-72 bg-background border-l border-border flex flex-col md:hidden animate-slide-in-right">
            {/* Drawer header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <span className="font-semibold text-text-primary text-sm">메뉴</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                <X size={18} className="text-text-secondary" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith(href)
                      ? 'text-accent bg-accent/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  )}
                >
                  {label}
                </Link>
              ))}

              {/* Write button */}
              {session?.user && (
                <Link
                  href="/post/new"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-accent text-background hover:bg-accent-dim transition-colors mt-2"
                >
                  <PenLine size={14} /> 글쓰기
                </Link>
              )}
            </nav>

            {/* User info at bottom */}
            {session?.user && (
              <div className="p-3 border-t border-border space-y-1">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={session.user.name} image={session.user.image} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{session.user.name}</p>
                    <TierBadge points={session.user.points ?? 0} showPoints />
                  </div>
                </div>
                {session.user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
                    <Shield size={14} /> 관리자 패널
                  </Link>
                )}
                <Link href="/profile" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
                  <User size={14} /> 프로필 설정
                </Link>
                <button onClick={() => { setMobileOpen(false); signOut() }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-red-400 hover:bg-surface-2 transition-colors">
                  <LogOut size={14} /> 로그아웃
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

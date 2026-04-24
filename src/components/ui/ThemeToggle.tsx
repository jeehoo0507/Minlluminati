'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon, Terminal } from 'lucide-react'

type Theme = 'light' | 'dark' | 'dev'

const THEMES: Theme[] = ['light', 'dark', 'dev']

const ICONS = {
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
  dev: <Terminal size={16} />,
}

const TITLES = {
  light: '라이트 모드',
  dark: '다크 모드',
  dev: '개발자 모드',
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const html = document.documentElement
    if (html.classList.contains('dev')) setTheme('dev')
    else if (html.classList.contains('dark')) setTheme('dark')
    else setTheme('light')
  }, [])

  function toggle() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
    setTheme(next)
    const html = document.documentElement
    html.classList.remove('dark', 'dev')
    if (next === 'dark') html.classList.add('dark')
    if (next === 'dev') html.classList.add('dev')
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`
  }

  if (!mounted) return <div className="w-8 h-8" />

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
      title={`현재: ${TITLES[theme]} (클릭하면 ${TITLES[THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]]})`}
    >
      {ICONS[theme]}
    </button>
  )
}

import type { Metadata } from 'next'
import './globals.css'
import { cookies } from 'next/headers'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: '양현재+',
  description: '양현재+ 스터디 그룹 문제풀이 플랫폼',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = cookies().get('theme')?.value ?? 'light'

  return (
    <html lang="ko" className={theme === 'dark' ? 'dark' : theme === 'dev' ? 'dev' : ''} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-text-primary">
        <Providers>
          <Header />
          <main className="pt-14">{children}</main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}

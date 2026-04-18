import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Min(joon)lluminati — 하루 한 문제',
  description: '민루미나티 스터디 그룹 문제풀이 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-background text-text-primary">
        <Providers>
          <Header />
          <main className="pt-14">{children}</main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { background: '#1c1c1c', color: '#f0f0f0', border: '1px solid #2a2a2a' },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}

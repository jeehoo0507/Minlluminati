import { NextAuthOptions, getServerSession } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import type { Adapter } from 'next-auth/adapters'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          points: user.points,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'USER'
        token.points = (user as { points?: number }).points ?? 0
      }
      // 포인트/역할 업데이트 후 세션 갱신
      if (trigger === 'update' && session) {
        token.role = session.role ?? token.role
        token.points = session.points ?? token.points
      }
      // DB에서 최신 포인트 가져오기
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { points: true, role: true },
        })
        if (dbUser) {
          token.points = dbUser.points
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.points = token.points as number
      }
      return session
    },
    async signIn({ user, account }) {
      // Google 로그인 시 허용된 이메일인지 확인 (기존 유저는 통과)
      if (account?.provider === 'google' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (existingUser) return true

        const allowed = await prisma.allowedEmail.findUnique({
          where: { email: user.email },
        })
        if (!allowed) return false

        // 허용 이메일 사용 처리
        await prisma.allowedEmail.update({
          where: { email: user.email },
          data: { usedAt: new Date() },
        })
      }
      return true
    },
  },
}

export async function getAuth() {
  return getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getAuth()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'ADMIN') throw new Error('Forbidden')
  return session
}

import { NextAuthOptions, getServerSession } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import type { Adapter } from 'next-auth/adapters'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user || !user.password) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role, points: user.points }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'USER'
        token.points = (user as { points?: number }).points ?? 0
      }
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { points: true, role: true },
        })
        if (dbUser) { token.points = dbUser.points; token.role = dbUser.role }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.points = token.points as number
        const dbRole = token.role as string
        session.user.isOwner = dbRole === 'OWNER'
        // OWNER는 모든 ADMIN 기능을 사용 가능 — role을 ADMIN으로 노출
        session.user.role = dbRole === 'OWNER' ? 'ADMIN' : dbRole
      }
      return session
    },
  },
}

export async function getAuth() { return getServerSession(authOptions) }
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

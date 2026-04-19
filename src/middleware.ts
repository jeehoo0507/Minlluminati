import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow API routes (they handle auth individually) and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  let token = null
  try {
    token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  } catch {
    // If token verification fails, treat as unauthenticated
  }

  // Already logged in → redirect away from login page
  if (token && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/feed', req.url))
  }

  // Not logged in → redirect to login
  if (!token && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

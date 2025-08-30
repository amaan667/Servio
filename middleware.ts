import { NextRequest, NextResponse } from 'next/server'

const PUBLIC = ['/', '/auth/callback', '/sign-in', '/_next', '/favicon', '/images', '/api/health']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const hasAuthCookie = [...req.cookies.getAll()].some(k => k.name.includes('-auth-token'))
  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
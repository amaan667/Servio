import { NextRequest, NextResponse } from 'next/server'
import { getRequestOrigin } from '@/lib/origin'

const PUBLIC = ['/', '/auth/callback', '/sign-in', '/_next', '/favicon', '/images', '/api/health']

function getOrigin(req: NextRequest) {
  return getRequestOrigin(req)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const hasAuthCookie = [...req.cookies.getAll()].some(k => k.name.includes('-auth-token'))
  if (!hasAuthCookie) {
    const origin = getOrigin(req);
    return NextResponse.redirect(`${origin}/sign-in`)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
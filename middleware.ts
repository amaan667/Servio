import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC = ['/', '/sign-in', '/auth/callback', '/auth/error', '/api/env']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (
    PUBLIC.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|static|favicon.ico).*)'] }

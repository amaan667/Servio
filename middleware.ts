import { NextRequest, NextResponse } from 'next/server'
const PUBLIC = ['/', '/auth/callback', '/sign-in', '/_next', '/favicon', '/images']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const hasSb = [...req.cookies.keys()].some(k => k.includes('-auth-token'))
  if (!hasSb) return NextResponse.redirect(new URL('/sign-in', req.url))

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
import { NextRequest, NextResponse } from 'next/server'
import { getRequestOrigin } from '@/lib/origin'

// Add all public paths that should bypass auth checks
const PUBLIC = [
  '/', 
  '/auth/callback', 
  '/sign-in', 
  '/sign-up',
  '/api/auth',
  '/api/health',
  '/_next', 
  '/favicon', 
  '/images',
  '/debug-auth'
]

function getOrigin(req: NextRequest) {
  return getRequestOrigin(req)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  // Check if the path is public (no auth required)
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for auth cookies - match the exact cookie names set by Supabase SSR
  const hasAuthCookie = [...req.cookies.getAll()].some(k =>
    k.name === 'sb-access-token' ||
    k.name === 'sb-refresh-token' ||
    k.name.startsWith('sb-') && k.name.includes('-auth-token')
  )
  
  if (!hasAuthCookie) {
    // If no auth cookie is found, redirect to sign-in
    const origin = getOrigin(req);
    return NextResponse.redirect(`${origin}/sign-in`)
  }

  // Continue to the requested page if authenticated
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
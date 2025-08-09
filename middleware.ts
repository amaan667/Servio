// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC = ['/', '/sign-in', '/auth/callback', '/auth/error', '/api/env', '/auth/debug'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public routes through
  if (
    PUBLIC.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) return NextResponse.next();

  // Optional protection based on cookie presence (fast path)
  const hasSbCookie = Array.from(req.cookies.getAll()).some(c => c.name.includes('-auth-token'));
  if (!hasSbCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!.*\\.).*)'] };

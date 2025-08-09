import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/', '/sign-in', '/auth/callback', '/auth/error', '/api/env', '/auth/debug'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) return NextResponse.next();

  // OPTIONAL: simple protection by cookie presence
  const hasSb = req.cookies.getAll().some(c => c.name.includes('-auth-token'));
  if (!hasSb) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!.*\\.).*)'] };

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/', '/sign-in', '/sign-up', '/auth/callback', '/auth/error', '/auth/debug', '/api/env'];

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  if (
    PUBLIC.includes(p) ||
    p.startsWith('/_next') || p.startsWith('/static') || p === '/favicon.ico'
  ) return NextResponse.next();

  // (optional) simple protection by cookie presence
  const hasSb = req.cookies.getAll().some(c => c.name.includes('-auth-token'));
  if (!hasSb) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
export const config = { matcher: ['/((?!.*\\.).*)'] };

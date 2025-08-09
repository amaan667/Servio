import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/', '/sign-in', '/auth/callback', '/auth/error', '/auth/debug', '/api/env'];

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (
    PUBLIC.includes(p) ||
    p.startsWith('/_next') ||
    p.startsWith('/static') ||
    p === '/favicon.ico'
  ) return NextResponse.next();

  // Optional: add auth later; leave it open for the test
  return NextResponse.next();
}
export const config = { matcher: ['/((?!.*\\.).*)'] };

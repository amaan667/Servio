import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/', '/sign-in', '/sign-up', '/auth/callback', '/auth/error', '/auth/debug', '/api/env'];

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (PUBLIC.includes(p) || p.startsWith('/_next') || p.startsWith('/static') || p === '/favicon.ico') {
    return NextResponse.next();
  }
  return NextResponse.next(); // keep simple for now
}

export const config = { matcher: ['/((?!.*\\.).*)'] };

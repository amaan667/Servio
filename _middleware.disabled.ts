import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Middleware disabled to avoid interfering with OAuth callbacks
export async function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};
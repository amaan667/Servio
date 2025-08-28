import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROD_BASE = 'https://servio-production.up.railway.app';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Never intercept auth routes or URLs with code/error parameters
  if (req.nextUrl.pathname.startsWith('/auth/') || 
      req.nextUrl.searchParams.has('code') || 
      req.nextUrl.searchParams.has('error')) {
    return res;
  }

  // Force https and the exact production host (only in production)
  if (process.env.NODE_ENV === 'production') {
    const isHttps = req.nextUrl.protocol === 'https:';
    const host = req.headers.get('host');

    if (!isHttps || host !== 'servio-production.up.railway.app') {
      const redirectUrl = new URL(req.nextUrl);
      redirectUrl.protocol = 'https:';
      redirectUrl.host = 'servio-production.up.railway.app';
      return NextResponse.redirect(redirectUrl, 308);
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};
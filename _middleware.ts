// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROD_BASE = process.env.NEXT_PUBLIC_APP_URL!;
const PROD_URL = new URL(PROD_BASE);
const PROD_HOST = PROD_URL.host;

export function middleware(req: NextRequest) {
  // Force https and the exact production host
  const isHttps = req.nextUrl.protocol === 'https:';
  const host = req.headers.get('host');

  if (!isHttps || host !== PROD_HOST) {
    const redirectUrl = new URL(req.nextUrl);
    redirectUrl.protocol = 'https:';
    redirectUrl.host = PROD_HOST;
    return NextResponse.redirect(redirectUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};

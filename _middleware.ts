// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // Never intercept the auth callback
  if (p.startsWith('/auth/')) return NextResponse.next();

  // Skip auto-redirect for /sign-in if signedOut=true
  if (p === '/sign-in' && req.nextUrl.searchParams.get('signedOut') === 'true') {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  try {
    const supabase = createMiddlewareClient({ req, res });
    await supabase.auth.getSession(); // sync cookies for SSR
  } catch {
    // swallow
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)',
  ],
};

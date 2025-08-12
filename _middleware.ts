// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const host = req.headers.get('host');
  console.log('[AUTH DEBUG] middleware start', { path: p, host });
  if (p.startsWith('/auth/')) {
    console.log('[AUTH DEBUG] middleware bypass for /auth/*');
    return NextResponse.next(); // never gate callback
  }

  const res = NextResponse.next();
  try {
    const supabase = createMiddlewareClient({ req, res });
    console.log('[AUTH DEBUG] middleware calling getSession to sync cookies');
    await supabase.auth.getSession(); // sync cookies for SSR
    console.log('[AUTH DEBUG] middleware getSession complete');
  } catch (e) {
    console.log('[AUTH DEBUG] middleware getSession error', { message: (e as any)?.message });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)'],
};

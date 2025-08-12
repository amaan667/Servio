// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.startsWith('/auth/')) return NextResponse.next(); // never gate callback

  const res = NextResponse.next();
  try {
    const supabase = createMiddlewareClient({ req, res });
    await supabase.auth.getSession(); // sync cookies for SSR
  } catch {}
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)'],
};

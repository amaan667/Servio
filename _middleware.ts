// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const res = NextResponse.next();

  // Never touch auth pages
  if (p.startsWith('/auth/')) return res;

  // Light cookie sync for the rest
  try {
    const supabase = createMiddlewareClient({ req, res });
    await supabase.auth.getSession();
  } catch {}
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)'],
};

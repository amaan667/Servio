import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const hasCode = url.searchParams.has("code");

  // Always allow OAuth callback and any request that carries the code param
  if (pathname.startsWith("/auth/callback") || hasCode) {
    console.log('[AUTH DEBUG] Middleware: allowing OAuth callback/code request', { pathname, hasCode });
    return NextResponse.next();
  }

  const res = NextResponse.next();
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    await supabase.auth.getSession(); // propagates cookies to SSR
  } catch (error) {
    console.error('[AUTH DEBUG] Middleware error:', error);
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};



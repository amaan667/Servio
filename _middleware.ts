// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // Never intercept the auth callback
  if (p.startsWith('/auth/')) return NextResponse.next();

  // Skip auto-redirect for /sign-in if signedOut=true or has error params
  if (p === '/sign-in' && (
    req.nextUrl.searchParams.get('signedOut') === 'true' ||
    req.nextUrl.searchParams.get('error')
  )) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => {
            res.cookies.set({ name, value, ...options });
          },
          remove: (name, options) => {
            res.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );
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

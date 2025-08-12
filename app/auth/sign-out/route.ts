export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies as nextCookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host')  ?? h.get('host')!;
  const base  = `${proto}://${host}`;

  const jar = nextCookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o, path: '/', secure: true, sameSite: 'lax' }),
        remove: (n, o) => jar.set({ name: n, value: '', ...o, path: '/', secure: true, sameSite: 'lax' }),
      },
    }
  );

            // Server sign-out (clears Supabase session cookies)
          await supabase.auth.signOut();

          // Clear all auth-related cookies to ensure clean state
          const authCookies = [
            'sb-access-token', 
            'sb-refresh-token', 
            'supabase-auth-token',
            'supabase-auth-token-0',
            'supabase-auth-token-1',
            'supabase-auth-token-2',
            'supabase-auth-token-3',
            'supabase-auth-token-4',
            'supabase-auth-token-5',
            'supabase-auth-token-6',
            'supabase-auth-token-7',
            'supabase-auth-token-8',
            'supabase-auth-token-9'
          ];
          
          authCookies.forEach(cookieName => {
            jar.set({ 
              name: cookieName, 
              value: '', 
              path: '/', 
              secure: true, 
              sameSite: 'lax',
              maxAge: 0,
              expires: new Date(0)
            });
          });

          // Also clear any localStorage/sessionStorage by redirecting to a client-side clear page first
          const clearUrl = new URL('/auth/clear-session', base);
          clearUrl.searchParams.set('redirect', '/sign-in?signedOut=true');
          return NextResponse.redirect(clearUrl);
}

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
          const authCookies = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token'];
          authCookies.forEach(cookieName => {
            jar.set({ 
              name: cookieName, 
              value: '', 
              path: '/', 
              secure: true, 
              sameSite: 'lax',
              maxAge: 0 
            });
          });

          // Hard redirect to sign-in (no client state needed)
          return NextResponse.redirect(new URL('/sign-in?signedOut=true', base));
}

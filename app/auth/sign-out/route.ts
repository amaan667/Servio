export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies as nextCookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  console.log('[AUTH] Sign-out route called');
  
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

  console.log('[AUTH] Signing out user');
  // Server sign-out with local scope (clears Supabase session cookies)
  await supabase.auth.signOut({ scope: 'local' });

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

  // Clear the Supabase PKCE code_verifier cookie
  jar.set({
    name: 'supabase-auth-code-verifier',
    value: '',
    path: '/',
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0)
  });

  console.log('[AUTH] Redirecting to clear session page');
  // Redirect to client-side clear page to handle localStorage/sessionStorage
  const clearUrl = new URL('/auth/clear-session', base);
  clearUrl.searchParams.set('redirect', '/?signedOut=true');
  
  const response = NextResponse.redirect(clearUrl);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

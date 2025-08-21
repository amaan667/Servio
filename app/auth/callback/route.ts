export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/dashboard';

  console.log('[AUTH] callback starting', {
    hasCode: !!code,
    hasError: !!error,
    base: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=oauth_error', req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', req.url));
  }

  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set(n, v, { ...o, httpOnly: true, sameSite: 'lax', secure: true }),
        remove: (n, o) => jar.set(n, '', { ...o, httpOnly: true, sameSite: 'lax', secure: true, maxAge: 0 }),
      },
    }
  );

  // 🚫 Call this exactly once. Do NOT exchange in middleware or anywhere else.
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[AUTH] exchange failed:', exchangeError);
    // PKCE/state/cookie mismatch or domain mismatch will end here.
    return NextResponse.redirect(new URL('/sign-in?error=oauth_exchange_failed', req.url));
  }

  return NextResponse.redirect(new URL(next, req.url));
}

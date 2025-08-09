export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  console.log('[AUTH] /auth/callback hit. code?', !!code, 'host:', url.host);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookies().get(name)?.value,
        set: (name, value, options) => cookies().set({ name, value, ...options }),
        remove: (name, options) => cookies().set({ name, value: '', ...options }),
      },
    }
  );

  if (!code) {
    console.log('[AUTH] No code in callback, redirecting to sign-in');
    return NextResponse.redirect(new URL('/sign-in?error=no_code', process.env.NEXT_PUBLIC_APP_URL!));
  }

  console.log('[AUTH] Exchanging code for session...');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  
  if (error) {
    console.error('[AUTH] Exchange failed:', error.message);
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, process.env.NEXT_PUBLIC_APP_URL!));
  }

  console.log('[AUTH] Session exchange successful, redirecting to dashboard');
  return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL!));
}

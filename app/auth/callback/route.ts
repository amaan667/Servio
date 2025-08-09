export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { APP_URL } from '@/lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  console.log('[AUTH] /auth/callback hit. code?', !!code);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookies().get(n)?.value,
        set: (n, v, o) => cookies().set({ name: n, value: v, ...o }),
        remove: (n, o) => cookies().set({ name: n, value: '', ...o }),
      },
    }
  );

  if (!code) {
    console.error('[AUTH] Missing code');
    return NextResponse.redirect(new URL('/sign-in?error=no_code', APP_URL));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[AUTH] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, APP_URL));
  }

  // Prove cookie/session exists now
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[AUTH] user after exchange?', !!user);

  return NextResponse.redirect(new URL('/dashboard', APP_URL));
}
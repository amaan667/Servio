export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  console.log('[AUTH] Callback route called');
  
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host')  ?? h.get('host')!;
  const base  = `${proto}://${host}`;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) {
    console.log('[AUTH] No code in callback');
    return NextResponse.redirect(new URL('/sign-in?error=no_code', base));
  }

  const jar = cookies();
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

  console.log('[AUTH] Exchanging code for session');
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) {
    console.error('[AUTH] Exchange failed:', exErr);
    return NextResponse.redirect(new URL('/sign-in?error=exchange_failed', base));
  }

  console.log('[AUTH] Getting user after exchange');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[AUTH] No user after exchange');
    return NextResponse.redirect(new URL('/sign-in?error=no_user', base));
  }

  console.log('[AUTH] Querying venues for user', { userId: user.id });
  const { data: venues, error: vErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  if (vErr) {
    console.error('[AUTH] Venues query error:', vErr);
    return NextResponse.redirect(new URL('/complete-profile?error=venues', base));
  }

  if (!venues?.length) {
    console.log('[AUTH] No venues found, redirecting to complete profile');
    return NextResponse.redirect(new URL('/complete-profile', base));
  }

  const redirectUrl = new URL(`/dashboard/${venues[0].venue_id}`, base);
  console.log('[AUTH] Redirecting to dashboard', { venueId: venues[0].venue_id });
  
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

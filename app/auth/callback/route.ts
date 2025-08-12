export const runtime = 'nodejs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host')  ?? h.get('host')!;
  const base  = `${proto}://${host}`;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/sign-in?error=no_code', base));

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

  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) {
    console.error('[AUTH] exchange failed:', exErr);
    return NextResponse.redirect(new URL('/sign-in?error=exchange_failed', base));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/sign-in?error=no_user', base));

  const { data: venues, error: vErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  if (vErr) {
    console.error('[AUTH] venues query error:', vErr);
    return NextResponse.redirect(new URL('/complete-profile?error=venues', base));
  }

  if (!venues?.length) {
    return NextResponse.redirect(new URL('/complete-profile', base));
  }

  return NextResponse.redirect(new URL(`/dashboard/${venues[0].venue_id}`, base));
}

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { log, error } from '@/lib/debug';

export async function GET(req: Request) {
  const h = headers();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const base = `${proto}://${host}`;

  log('CALLBACK start', { code: !!code, host, proto });

  if (!code) return NextResponse.redirect(new URL('/sign-in?e=no_code', base));

  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
        remove: (n, o) => jar.set({ name: n, value: '', ...o }),
    } }
  );

  log('CALLBACK exchange start');
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) {
    error('CALLBACK exchange error', { name: exErr.name, msg: exErr.message, status: (exErr as any)?.status });
    return NextResponse.redirect(new URL('/sign-in?e=exchange_failed', base));
  }

  const { data: { user } } = await supabase.auth.getUser();
  log('CALLBACK user', { user: !!user });

  if (!user) return NextResponse.redirect(new URL('/sign-in?e=no_user', base));

  const { data: venues, error: vErr } = await supabase
    .from('venues').select('venue_id').eq('owner_id', user.id).limit(1);

  if (vErr) {
    error('CALLBACK venues error', { msg: vErr.message });
    return NextResponse.redirect(new URL('/complete-profile?e=venues', base));
  }

  const dest = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
  log('CALLBACK redirect', { dest });
  return NextResponse.redirect(new URL(dest, base));
}

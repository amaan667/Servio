export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { APP_URL } from '@/lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  console.log('[AUTH] /auth/callback hit. code?', !!code, 'host:', url.host);

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
    return NextResponse.json({ ok: false, where: 'no_code' }, { status: 400 });
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[AUTH] exchangeCodeForSession error:', error.message);
    return NextResponse.json({ ok: false, where: 'exchange', error: error.message }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log('[AUTH] user after exchange?', !!user);

  cookies().set({ name: 'dbg', value: '1', httpOnly: true, sameSite: 'lax', secure: true, path: '/' });

  return NextResponse.redirect(new URL('/auth/debug', APP_URL));
}
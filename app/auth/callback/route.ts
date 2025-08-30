export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getRequestBaseUrl } from '@/lib/getBaseUrl';

function cookieAdapter(jar: any) {
  return {
    get: (name: string) => jar.get(name)?.value,
    set: (name: string, value: string, options?: any) =>
      jar.set(name, value, {
        ...options,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      }),
    remove: (name: string, options?: any) =>
      jar.set(name, '', {
        ...options,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 0,
      }),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const hdrs: any = await headers();
  const baseOrigin = getRequestBaseUrl(hdrs as any);

  console.log('[AUTH] callback starting', {
    hasCode: !!code,
    hasError: !!error,
    base: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=oauth_error', baseOrigin));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', baseOrigin));
  }

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

  // Only exchange here. Do not exchange anywhere else (middleware, other routes, etc.).
  let exchanged = false;
  try {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    exchanged = !exchangeError && !!data?.session;
    if (exchangeError) {
      console.error('[AUTH] exchange failed:', exchangeError);
      const msg = exchangeError.message || '';
      // Normalize refresh token reuse / not found conditions
      if (/refresh token/i.test(msg) || /already used/i.test(msg) || /not found/i.test(msg)) {
        // Clean cookies to avoid looping on stale verifier
        try {
          const cookieStore: any = await cookies();
          ['sb-access-token','sb-refresh-token'].forEach(name => {
            try { cookieStore.set(name, '', { path:'/', maxAge:0, secure:true, sameSite:'lax', httpOnly:true }); } catch {}
          });
        } catch {}
        return NextResponse.redirect(new URL('/sign-in?error=session_expired', baseOrigin));
      }
      return NextResponse.redirect(new URL('/sign-in?error=oauth_exchange_failed', baseOrigin));
    }
  } catch (err) {
    console.error('[AUTH] unexpected exchange exception', err);
    return NextResponse.redirect(new URL('/sign-in?error=unexpected_error', baseOrigin));
  }
  // Try to fetch user and their first venue to deep-link if possible
  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.warn('[AUTH] getUser error after exchange', userErr);
    }
    if (user) {
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      const venueId = venues?.[0]?.venue_id as string | undefined;
      const dest = venueId ? `/dashboard/${venueId}` : next;
    return NextResponse.redirect(new URL(dest, baseOrigin));
    }
  } catch (e) {
    console.warn('[AUTH] callback post-exchange redirect fallback', e);
  }
  return NextResponse.redirect(new URL(next, baseOrigin));
}

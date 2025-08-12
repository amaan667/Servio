import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { log, error } from '@/lib/debug';

// Derive the public base URL from forwarded headers (Railway proxy) or env
function getBaseUrl(req: Request) {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '');
  return `${proto}://${host}`;
}

// Compute a safe cookie domain. For localhost, omit domain (host-only cookie).
function getCookieDomain(hostname: string | null) {
  if (!hostname) return undefined;
  const bare = hostname.replace(/:\d+$/, '');
  if (bare === 'localhost' || /^[0-9.]+$/.test(bare)) return undefined;
  return bare;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');

  const baseUrl = getBaseUrl(req);
  const hostname = new URL(baseUrl).hostname;
  const cookieDomain = getCookieDomain(hostname);

  log('CALLBACK start', { code: !!code, hostname, baseUrl });

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=no_code', baseUrl));
  }

  // Build a cookie bridge that forces the correct domain/flags
  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => jar.get(name)?.value,
        set: (name, value, options) => {
          jar.set({
            name,
            value,
            ...options,
            domain: cookieDomain ?? options?.domain,
            secure: true,
            sameSite: 'lax',
            path: '/',
          });
        },
        remove: (name, options) => {
          jar.set({
            name,
            value: '',
            ...options,
            domain: cookieDomain ?? options?.domain,
            secure: true,
            sameSite: 'lax',
            path: '/',
          });
        },
      },
    }
  );

  log('CALLBACK exchange start');
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) {
    error('CALLBACK exchange error', { name: exErr.name, msg: exErr.message, status: (exErr as any)?.status });
    return NextResponse.redirect(new URL('/sign-in?error=exchange_failed', baseUrl));
  }

  const { data: { user } } = await supabase.auth.getUser();
  log('CALLBACK user', { user: !!user, userId: user?.id });

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in?error=no_user', baseUrl));
  }

  // If a 'next' param was provided, honor it
  if (next) {
    log('CALLBACK honoring next param', { next });
    return NextResponse.redirect(new URL(String(next), baseUrl));
  }

  // Check if user has existing venues
  const { data: venues, error: vErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  if (vErr) {
    error('CALLBACK venues error', { msg: vErr.message });
    return NextResponse.redirect(new URL('/complete-profile?error=venues', baseUrl));
  }

  const dest = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
  log('CALLBACK redirect', { dest, hasVenues: venues?.length > 0 });
  return NextResponse.redirect(new URL(dest, baseUrl));
}

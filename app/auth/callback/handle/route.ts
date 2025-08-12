export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Derive the public base URL from forwarded headers (Railway proxy) or env
function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '');
  return `${proto}://${host}`;
}

// Compute a safe cookie domain. For localhost, omit domain (host-only cookie).
function getCookieDomain(hostname: string | null) {
  if (!hostname) return undefined;
  const bare = hostname.replace(/:\d+$/, '');
  if (bare === 'localhost' || /^[0-9.]+$/.test(bare)) return undefined;
  // use the exact host
  return bare;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');

  const baseUrl = getBaseUrl(req);
  const hostname = new URL(baseUrl).hostname;
  const cookieDomain = getCookieDomain(hostname);

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=no_code', baseUrl));
  }

  // Build a cookie bridge that forces the correct domain/flags
  const jar = nextCookies();
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
            // merge options from Supabase, but override domain/secure/samesite/path sensibly
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

  // Do the PKCE code exchange (sets cookies via the adapter above)
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    return NextResponse.redirect(new URL('/sign-in?error=exchange_failed', baseUrl));
  }

  // We should have a session now
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in?error=no_user', baseUrl));
  }

  // If a 'next' param was provided, honor it
  if (next) {
    return NextResponse.redirect(new URL(String(next), baseUrl));
  }

  // New vs existing: check venues
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  const dest = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
  return NextResponse.redirect(new URL(dest, baseUrl));
}

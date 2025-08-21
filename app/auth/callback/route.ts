export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

  // Only exchange here. Do not exchange anywhere else (middleware, other routes, etc.).
  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AUTH] exchange failed:', exchangeError);
      
      // Handle refresh token issues specially
      if (exchangeError.message?.includes('Invalid Refresh Token') || 
          exchangeError.message?.includes('Already Used') ||
          exchangeError.message?.includes('token_already_used')) {
        console.log('[AUTH] Detected refresh token already used. Proceeding safely.');
        // Best-effort: try to continue to app; if not authenticated, guards will redirect
        const base = process.env.NODE_ENV === 'production'
          ? (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app')
          : url.origin;
        return NextResponse.redirect(new URL(next, base));
      }
      
      return NextResponse.redirect(new URL('/sign-in?error=oauth_exchange_failed', url.origin));
    }
  } catch (error) {
    console.error('[AUTH] Unexpected error during code exchange:', error);
    return NextResponse.redirect(new URL('/sign-in?error=unexpected_error', url.origin));
  }
  // Try to fetch user and their first venue to deep-link if possible
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      const venueId = venues?.[0]?.venue_id as string | undefined;
      const dest = venueId ? `/dashboard/${venueId}` : next;
      const base = process.env.NODE_ENV === 'production'
        ? (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app')
        : url.origin;
      return NextResponse.redirect(new URL(dest, base));
    }
  } catch (e) {
    console.warn('[AUTH] callback post-exchange redirect fallback', e);
  }
  {
    const base = process.env.NODE_ENV === 'production'
      ? (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app')
      : url.origin;
    return NextResponse.redirect(new URL(next, base));
  }
}

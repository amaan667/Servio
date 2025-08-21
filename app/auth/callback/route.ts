export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { cookieAdapter } from '@/lib/server/supabase';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  console.log('[AUTH] starting oauth callback');
  
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host')!;
  const base = `${proto}://${host}`;
  
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const state = url.searchParams.get('state');
  const next = url.searchParams.get('next') ?? '/dashboard';
  
  console.log('[AUTH] callback params:', { 
    hasCode: !!code, 
    codeLength: code?.length, 
    oauthError, 
    errorDescription,
    hasState: !!state,
    base 
  });

  // Handle OAuth errors from provider
  if (oauthError) {
    console.log('[AUTH] OAuth error from provider:', oauthError, errorDescription);
    return NextResponse.redirect(new URL(`/sign-in?error=oauth_error&message=${encodeURIComponent(errorDescription || oauthError)}`, base));
  }

  // If no code, bounce back to sign-in
  if (!code) {
    console.log('[AUTH] missing code, redirecting to sign-in');
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', base));
  }

  const jar = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );

  // IMPORTANT: Only call this ONCE per callback
  console.log('[AUTH] callback exchanging with code length:', code.length);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[AUTH] exchange failed:', error.message);
    
    // Handle specific error cases
    if (error.message.includes('refresh_token_already_used') || error.message.includes('Invalid Refresh Token')) {
      console.log('[AUTH] Refresh token already used, redirecting to sign-in');
      return NextResponse.redirect(new URL('/sign-in?error=token_reused', base));
    }
    
    if (error.message.includes('both auth code and code verifier should be non-empty')) {
      console.log('[AUTH] Missing auth code or code verifier');
      return NextResponse.redirect(new URL('/sign-in?error=validation_failed', base));
    }
    
    // Most common: PKCE state/cookie mismatch or double-exchange
    return NextResponse.redirect(new URL(`/sign-in?error=exchange_failed&message=${encodeURIComponent(error.message)}`, base));
  }

  if (!data.user) {
    console.log('[AUTH] no user after exchange');
    return NextResponse.redirect(new URL('/sign-in?error=no_user', base));
  }

  console.log('[AUTH] exchange ok, user:', data.user.id);

  // Check if user has venues
  const { data: venues, error: vErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', data.user.id)
    .limit(1);

  if (vErr) {
    console.error('[AUTH] venues query error:', vErr);
    return NextResponse.redirect(new URL('/complete-profile?error=venues', base));
  }

  if (!venues?.length) {
    console.log('[AUTH] no venues found, redirecting to complete profile');
    return NextResponse.redirect(new URL('/complete-profile', base));
  }

  // Success: user session cookies are now set
  const redirectUrl = new URL(`/dashboard/${venues[0].venue_id}`, base);
  console.log('[AUTH] redirecting to dashboard:', venues[0].venue_id);
  
  return NextResponse.redirect(redirectUrl);
}

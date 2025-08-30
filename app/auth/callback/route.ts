export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

async function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host') ?? h.get('host')!;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const baseUrl = await getBaseUrl();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  console.log('[AUTH DEBUG] Callback received:', { 
    hasCode: !!code, 
    error, 
    url: req.url 
  });

  if (error) {
    console.log('[AUTH DEBUG] OAuth error in callback:', error);
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.log('[AUTH DEBUG] No code received in callback');
    return NextResponse.redirect(`${baseUrl}/?auth_error=no_code`);
  }

  try {
    const supabase = await createClient(cookies());
    
    // Clear any existing session first to avoid conflicts
    console.log('[AUTH DEBUG] Clearing existing session before exchange');
    await supabase.auth.signOut();
    
    console.log('[AUTH DEBUG] Exchanging code for session');
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.log('[AUTH DEBUG] Exchange error:', exchangeError);
      
      // Handle specific refresh token errors
      if (exchangeError.message?.includes('refresh_token_not_found') || 
          exchangeError.message?.includes('Invalid Refresh Token') ||
          exchangeError.code === 'refresh_token_not_found') {
        console.log('[AUTH DEBUG] Refresh token error detected, redirecting to sign-in');
        return NextResponse.redirect(`${baseUrl}/sign-in?error=token_expired&message=${encodeURIComponent('Please try signing in again')}`);
      }
      
      return NextResponse.redirect(
        `${baseUrl}/?auth_error=exchange_failed&reason=${encodeURIComponent(exchangeError.message)}`
      );
    }

    if (!data.session) {
      console.log('[AUTH DEBUG] No session after exchange');
      return NextResponse.redirect(`${baseUrl}/?auth_error=no_session`);
    }

    console.log('[AUTH DEBUG] Auth successful, session created:', {
      userId: data.session.user?.id,
      userEmail: data.session.user?.email,
      hasRefreshToken: !!data.session.refresh_token
    });
    
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (err: any) {
    console.log('[AUTH DEBUG] Unexpected error in callback:', err);
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=unexpected&reason=${encodeURIComponent(err.message)}`
    );
  }
}

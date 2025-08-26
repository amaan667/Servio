import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  console.log('[AUTH DEBUG] OAuth callback received', { 
    hasCode: !!code, 
    hasError: !!error, 
    next,
    url: requestUrl.toString() 
  });

  if (error) {
    console.log('[AUTH DEBUG] OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/sign-in?error=oauth_error&message=${encodeURIComponent(error)}`, requestUrl.origin)
    );
  }

  if (!code) {
    console.log('[AUTH DEBUG] No code provided');
    return NextResponse.redirect(
      new URL('/sign-in?error=missing_code', requestUrl.origin)
    );
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    console.log('[AUTH DEBUG] Exchanging code for session');
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.log('[AUTH DEBUG] Exchange failed:', exchangeError.message);
      return NextResponse.redirect(
        new URL(`/sign-in?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      );
    }

    if (!data.session) {
      console.log('[AUTH DEBUG] No session after exchange');
      return NextResponse.redirect(
        new URL('/sign-in?error=no_session', requestUrl.origin)
      );
    }

    console.log('[AUTH DEBUG] OAuth successful, redirecting to:', next);
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch (error: any) {
    console.log('[AUTH DEBUG] Unexpected error in callback:', error?.message);
    return NextResponse.redirect(
      new URL(`/sign-in?error=callback_error&message=${encodeURIComponent(error?.message || 'Unknown error')}`, requestUrl.origin)
    );
  }
}

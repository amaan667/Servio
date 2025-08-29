import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  console.log('[CALLBACK FLOW] Step 1: Callback route received');
  console.log('[CALLBACK FLOW] Request URL:', req.url);
  console.log('[CALLBACK FLOW] Request method:', req.method);
  
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  console.log('[CALLBACK FLOW] Step 2: URL parsing');
  console.log('[CALLBACK FLOW] Parsed URL:', url.toString());
  console.log('[CALLBACK FLOW] URL origin:', url.origin);
  console.log('[CALLBACK FLOW] URL hostname:', url.hostname);
  console.log('[CALLBACK FLOW] URL pathname:', url.pathname);
  console.log('[CALLBACK FLOW] URL search:', url.search);

  // Use the request origin for redirects to handle both local and production
  const redirectBase = url.origin
  console.log('[CALLBACK FLOW] Redirect base:', redirectBase);

  // Additional safety check - ensure we never use localhost
  const requestOrigin = url.origin
  if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
    console.log('[CALLBACK FLOW] WARNING: Request origin contains localhost:', requestOrigin);
  }

  console.log('[CALLBACK FLOW] Callback params:', { 
    hasCode: !!code, 
    hasError: !!error,
    requestOrigin: url.origin,
    hostname: url.hostname,
    redirectBase,
    willRedirectTo: redirectBase
  });

  if (error) {
    console.log('[CALLBACK FLOW] OAuth error:', error);
    return NextResponse.redirect(new URL('/?auth_error=oauth_error', redirectBase))
  }

  if (code) {
    console.log('[CALLBACK FLOW] Step 3: Processing OAuth code');
    console.log('[CALLBACK FLOW] OAuth code length:', code.length);
    console.log('[CALLBACK FLOW] OAuth code preview:', code.substring(0, 10) + '...');
    
    console.log('[CALLBACK FLOW] Step 4: Exchanging code for session');
    const supabase = createClient(cookies())
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.log('[CALLBACK FLOW] Exchange error:', exchangeError);
      return NextResponse.redirect(new URL('/?auth_error=exchange_failed', redirectBase))
    }

    console.log('[CALLBACK FLOW] Step 5: Session exchange result');
    console.log('[CALLBACK FLOW] Session exchange successful:', !!data.session);
    console.log('[CALLBACK FLOW] User ID:', data.session?.user?.id);
    console.log('[CALLBACK FLOW] User email:', data.session?.user?.email);
    console.log('[CALLBACK FLOW] Session access token:', data.session?.access_token ? 'Present' : 'Missing');
    
    // Check if user has venues and redirect accordingly
    if (data.session?.user) {
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', data.session.user.id)
        .limit(1);

      if (venues && venues.length > 0) {
        console.log('[CALLBACK FLOW] Step 6: User has venues');
        console.log('[CALLBACK FLOW] Venue count:', venues.length);
        console.log('[CALLBACK FLOW] First venue ID:', venues[0].venue_id);
        
        console.log('[CALLBACK FLOW] Step 7: Redirecting to dashboard');
        const dashboardUrl = `/dashboard/${venues[0].venue_id}`;
        const fullRedirectUrl = new URL(dashboardUrl, redirectBase).toString();
        console.log('[CALLBACK FLOW] Dashboard URL:', dashboardUrl);
        console.log('[CALLBACK FLOW] Full redirect URL:', fullRedirectUrl);
        
        return NextResponse.redirect(new URL(dashboardUrl, redirectBase))
      } else {
        console.log('[CALLBACK FLOW] Step 6: User has no venues');
        console.log('[CALLBACK FLOW] Redirecting to complete profile');
        const completeProfileUrl = new URL('/complete-profile', redirectBase).toString();
        console.log('[CALLBACK FLOW] Complete profile URL:', completeProfileUrl);
        
        return NextResponse.redirect(new URL('/complete-profile', redirectBase))
      }
    }
  }

  console.log('[CALLBACK FLOW] No code or session, redirecting to home');
  return NextResponse.redirect(new URL('/?auth_error=missing_code', redirectBase))
}

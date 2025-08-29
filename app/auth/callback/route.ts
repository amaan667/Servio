import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'

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

  // Use robust base URL helper instead of trusting req.url
  const redirectBase = getBaseUrl()
  console.log('[CALLBACK FLOW] Redirect base (from getBaseUrl):', redirectBase);

  // Additional safety check - ensure we never use localhost
  if (redirectBase.includes('localhost') || redirectBase.includes('127.0.0.1')) {
    console.error('[CALLBACK FLOW] ERROR: getBaseUrl returned localhost:', redirectBase);
    // Fall back to environment variable
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app'
    console.log('[CALLBACK FLOW] Using environment fallback:', envUrl);
    return NextResponse.redirect(`${envUrl}/?auth_error=base_url_error`)
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
    return NextResponse.redirect(`${redirectBase}/?auth_error=oauth_error`)
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
      return NextResponse.redirect(`${redirectBase}/?auth_error=exchange_failed`)
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
        const dashboardUrl = `${redirectBase}/dashboard/${venues[0].venue_id}`;
        console.log('[CALLBACK FLOW] Dashboard URL:', dashboardUrl);
        
        return NextResponse.redirect(dashboardUrl)
      } else {
        console.log('[CALLBACK FLOW] Step 6: User has no venues');
        console.log('[CALLBACK FLOW] Redirecting to complete profile');
        const completeProfileUrl = `${redirectBase}/complete-profile`;
        console.log('[CALLBACK FLOW] Complete profile URL:', completeProfileUrl);
        
        return NextResponse.redirect(completeProfileUrl)
      }
    }
  }

  console.log('[CALLBACK FLOW] No code or session, redirecting to home');
  return NextResponse.redirect(`${redirectBase}/?auth_error=missing_code`)
}

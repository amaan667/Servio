import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  console.log('[AUTH DEBUG] Route handler callback received');
  
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  console.log('[AUTH DEBUG] Callback params:', { 
    hasCode: !!code, 
    hasError: !!error,
    origin: url.origin,
    hostname: url.hostname 
  });

  if (error) {
    console.log('[AUTH DEBUG] OAuth error:', error);
    return NextResponse.redirect(new URL('/?auth_error=oauth_error', url.origin))
  }

  if (code) {
    console.log('[AUTH DEBUG] Exchanging code for session...');
    const supabase = createClient(cookies())
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.log('[AUTH DEBUG] Exchange error:', exchangeError);
      return NextResponse.redirect(new URL('/?auth_error=exchange_failed', url.origin))
    }

    console.log('[AUTH DEBUG] Session exchange successful:', !!data.session);
    
    // Check if user has venues and redirect accordingly
    if (data.session?.user) {
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', data.session.user.id)
        .limit(1);

      if (venues && venues.length > 0) {
        console.log('[AUTH DEBUG] Redirecting to dashboard:', venues[0].venue_id);
        return NextResponse.redirect(new URL(`/dashboard/${venues[0].venue_id}`, url.origin))
      } else {
        console.log('[AUTH DEBUG] Redirecting to complete profile');
        return NextResponse.redirect(new URL('/complete-profile', url.origin))
      }
    }
  }

  console.log('[AUTH DEBUG] No code or session, redirecting to home');
  return NextResponse.redirect(new URL('/?auth_error=missing_code', url.origin))
}
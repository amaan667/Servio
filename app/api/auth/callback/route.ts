import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthErr = url.searchParams.get('error');
  const base = process.env.NEXT_PUBLIC_APP_URL!;

  console.log('[AUTH] Callback start:', { hasCode: !!code, hasError: !!oauthErr });

  if (oauthErr) {
    console.error('[AUTH] OAuth error:', oauthErr);
    return NextResponse.redirect(`${base}/sign-in?error=${encodeURIComponent(oauthErr)}`);
  }
  
  if (!code) {
    console.error('[AUTH] No code in callback');
    return NextResponse.redirect(`${base}/sign-in?error=missing_code`);
  }

  try {
    const supabase = createServerSupabase();
    console.log('[AUTH] Exchanging code for session');
    
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AUTH] PKCE exchange failed:', exchangeError);
      return NextResponse.redirect(`${base}/sign-in?error=exchange_failed`);
    }

    console.log('[AUTH] PKCE exchange successful');

    // Get user and check venue presence
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[AUTH] No user after exchange');
      return NextResponse.redirect(`${base}/sign-in?error=no_user`);
    }

    console.log('[AUTH] User authenticated:', user.id);
    
    // Check if user has venues via RLS
    const { data: venues } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!venues || venues.length === 0) {
      console.log('[AUTH] New user, redirecting to complete profile');
      return NextResponse.redirect(`${base}/complete-profile`);
    }

    console.log('[AUTH] Existing user, redirecting to dashboard');
    return NextResponse.redirect(`${base}/dashboard/${venues[0].venue_id}`);
    
  } catch (error) {
    console.error('[AUTH] Unexpected error in callback:', error);
    return NextResponse.redirect(`${base}/sign-in?error=callback_error`);
  }
}

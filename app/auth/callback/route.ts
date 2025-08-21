import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/server/supabase';
import { handleGoogleSignUp } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  const base = process.env.NEXT_PUBLIC_APP_URL!;

  if (oauthError) {
    return NextResponse.redirect(`${base}/sign-in?error=${oauthError}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/sign-in?error=missing_code`);
  }

  const supabase = supabaseServer();
  // This reads the PKCE verifier cookie set by the browser client on YOUR domain
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[AUTH] PKCE exchange failed:', exchangeError);
    return NextResponse.redirect(`${base}/sign-in?error=pkce_failed`);
  }

  // Handle Google OAuth user setup
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('[AUTH] Google OAuth user authenticated:', user.id);
      
      // Check if this is a new Google user (no venues yet)
      const { data: existingVenues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .limit(1);
      
      if (!existingVenues || existingVenues.length === 0) {
        console.log('[AUTH] New Google user, creating venue');
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
        const result = await handleGoogleSignUp(user.id, user.email!, fullName);
        
        if (!result.success) {
          console.error('[AUTH] Failed to create venue for Google user:', result.error);
          return NextResponse.redirect(`${base}/complete-profile`);
        }
        
        console.log('[AUTH] Venue created for Google user:', result.venue?.venue_id);
      } else {
        console.log('[AUTH] Existing Google user, has venues');
      }
    }
  } catch (error) {
    console.error('[AUTH] Error handling Google OAuth user setup:', error);
    // Continue with redirect even if venue creation fails
  }

  return NextResponse.redirect(`${base}/dashboard`);
}

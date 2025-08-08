import { NextRequest, NextResponse } from 'next/server';
import { supabase, handleGoogleSignUp } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${baseUrl}/sign-in?error=oauth_error`);
    }

    if (code) {
      console.log('Processing OAuth callback with code:', code.substring(0, 10) + '...');
      
      try {
        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          return NextResponse.redirect(`${baseUrl}/sign-in?error=session_exchange_failed`);
        }

        if (data.session) {
          console.log('OAuth callback successful, user:', data.session.user.email);
          
          // Handle Google sign-up - create venue for new users
          const venueResult = await handleGoogleSignUp(
            data.session.user.id,
            data.session.user.email || '',
            data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name
          );
          
          if (venueResult.success) {
            console.log('Venue setup completed, redirecting to dashboard');
            return NextResponse.redirect(`${baseUrl}/dashboard`);
          } else {
            console.error('Failed to setup venue:', venueResult.error);
            // Still redirect to dashboard even if venue creation fails
            return NextResponse.redirect(`${baseUrl}/dashboard`);
          }
        } else {
          console.error('No session after code exchange');
          return NextResponse.redirect(`${baseUrl}/sign-in?error=no_session`);
        }
      } catch (exchangeError) {
        console.error('Exception during code exchange:', exchangeError);
        return NextResponse.redirect(`${baseUrl}/sign-in?error=exchange_exception`);
      }
    }

    // No code provided
    console.error('No code provided in OAuth callback');
    return NextResponse.redirect(`${baseUrl}/sign-in?error=no_code`);
  } catch (error) {
    console.error('Auth callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    return NextResponse.redirect(`${baseUrl}/sign-in?error=callback_error`);
  }
}
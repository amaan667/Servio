import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const access_token = searchParams.get('access_token');
    const refresh_token = searchParams.get('refresh_token');
    const token_type = searchParams.get('token_type');
    const expires_in = searchParams.get('expires_in');
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";

    console.log('OAuth callback received:', {
      hasCode: !!code,
      hasAccessToken: !!access_token,
      hasError: !!error,
      error: error
    });

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${baseUrl}/sign-in?error=oauth_error`);
    }

    // Handle token-based flow (if available)
    if (access_token && refresh_token) {
      console.log('Using token-based OAuth flow');
      
      try {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (sessionError) {
          console.error('Error setting session from tokens:', sessionError);
          return NextResponse.redirect(`${baseUrl}/sign-in?error=token_session_failed`);
        }

        if (data.session) {
          console.log('Token-based OAuth successful, user:', data.session.user.email);
          return NextResponse.redirect(`${baseUrl}/dashboard`);
        }
      } catch (tokenError) {
        console.error('Exception during token handling:', tokenError);
      }
    }

    // Handle code-based flow
    if (code) {
      console.log('Processing OAuth callback with code:', code.substring(0, 10) + '...');
      
      try {
        // Try the simple approach first
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          
          // If PKCE fails, try alternative approach
          if (exchangeError.message?.includes('code verifier')) {
            console.log('PKCE error detected, trying alternative OAuth completion...');
            
            // Redirect to a client-side handler that can complete the OAuth flow
            return NextResponse.redirect(`${baseUrl}/auth/complete?code=${code}`);
          }
          
          return NextResponse.redirect(`${baseUrl}/sign-in?error=session_exchange_failed`);
        }

        if (data.session) {
          console.log('OAuth callback successful, user:', data.session.user.email);
          
          // Create venue for new users (simplified)
          try {
            const venueId = `venue-${data.session.user.id.slice(0, 8)}`;
            
            const { error: venueError } = await supabase
              .from("venues")
              .upsert({
                venue_id: venueId,
                name: data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'My Venue',
                business_type: 'Restaurant',
                owner_id: data.session.user.id,
                email: data.session.user.email,
              });
            
            if (venueError) {
              console.error('Venue creation error (non-critical):', venueError);
            } else {
              console.log('Venue created/updated successfully');
            }
          } catch (venueError) {
            console.error('Venue creation exception (non-critical):', venueError);
          }
          
          return NextResponse.redirect(`${baseUrl}/dashboard`);
        } else {
          console.error('No session after code exchange');
          return NextResponse.redirect(`${baseUrl}/sign-in?error=no_session`);
        }
      } catch (exchangeError) {
        console.error('Exception during code exchange:', exchangeError);
        return NextResponse.redirect(`${baseUrl}/sign-in?error=exchange_exception`);
      }
    }

    // No code or token provided
    console.error('No code or token provided in OAuth callback');
    return NextResponse.redirect(`${baseUrl}/sign-in?error=no_auth_data`);
  } catch (error) {
    console.error('Auth callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    return NextResponse.redirect(`${baseUrl}/sign-in?error=callback_error`);
  }
}
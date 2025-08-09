import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { handleGoogleSignUp } from '@/lib/supabase';

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
        // Create response object for cookie handling
        const response = NextResponse.redirect(`${baseUrl}/dashboard`);
        
        // Create a Supabase client configured for server-side
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get: (name: string) => {
                return request.cookies.get(name)?.value;
              },
              set: (name: string, value: string, options: any) => {
                response.cookies.set({
                  name,
                  value,
                  ...options,
                });
              },
              remove: (name: string, options: any) => {
                response.cookies.set({
                  name,
                  value: '',
                  ...options,
                });
              },
            },
          }
        );

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
          } else {
            console.error('Failed to setup venue:', venueResult.error);
            // Still redirect to dashboard even if venue creation fails
          }
          
          return response;
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
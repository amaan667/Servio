import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/dashboard';
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app';

    if (!code) {
      console.error('No code provided in OAuth callback');
      return NextResponse.redirect(`${baseUrl}/sign-in?error=no_code`);
    }

    // Create a new response to handle cookies
    const response = NextResponse.redirect(`${baseUrl}${next}`);
    
    try {
      // Create a fresh Supabase client for this request
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: false,
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Get OAuth tokens from code
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(`${baseUrl}/sign-in?error=auth_failed`);
      }

      if (!data.session) {
        console.error('No session data received');
        return NextResponse.redirect(`${baseUrl}/sign-in?error=no_session`);
      }

      // Set auth cookies
      const cookieStore = cookies();
      response.cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      response.cookies.set('sb-refresh-token', data.session.refresh_token!, {
        path: '/',
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      // Create venue for new users
      try {
        const venueId = `venue-${data.session.user.id.slice(0, 8)}`;
        
        await supabase
          .from('venues')
          .upsert({
            venue_id: venueId,
            name: data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'My Venue',
            business_type: 'Restaurant',
            owner_id: data.session.user.id,
            email: data.session.user.email,
          });

        console.log('Venue created/updated successfully');
      } catch (venueError) {
        console.error('Non-critical venue creation error:', venueError);
        // Continue anyway - venue creation is not critical for auth
      }

      return response;
    } catch (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(`${baseUrl}/sign-in?error=callback_error`);
    }
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(`${baseUrl}/sign-in?error=unexpected`);
  }
}
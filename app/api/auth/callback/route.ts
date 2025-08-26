import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    console.log('[AUTH DEBUG] Server-side callback handler started');
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('[AUTH DEBUG] Server callback params:', { 
      hasCode: !!code, 
      error, 
      errorDescription 
    });

    if (error) {
      console.error('[AUTH DEBUG] Server callback error:', { error, errorDescription });
      return NextResponse.redirect(new URL(`https://servio-production.up.railway.app/sign-in?error=oauth_error&description=${errorDescription || ''}`));
    }

    if (!code) {
      console.log('[AUTH DEBUG] No code in server callback');
      return NextResponse.redirect(new URL('https://servio-production.up.railway.app/sign-in?error=no_code'));
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => request.cookies.get(name)?.value,
          set: (name, value, options) => {
            // This will be handled by the response
          },
          remove: (name, options) => {
            // This will be handled by the response
          },
        },
      }
    );

    console.log('[AUTH DEBUG] Exchanging code for session on server');
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession({
      queryParams: searchParams,
    });

    if (exchangeError) {
      console.error('[AUTH DEBUG] Server exchange error:', exchangeError);
      return NextResponse.redirect(new URL(`https://servio-production.up.railway.app/sign-in?error=exchange_failed&message=${exchangeError.message}`));
    }

    console.log('[AUTH DEBUG] Server exchange successful:', { 
      hasUser: !!data.user, 
      userId: data.user?.id 
    });

    // Redirect to dashboard with success - ALWAYS use production URL
    const response = NextResponse.redirect(new URL('https://servio-production.up.railway.app/dashboard'));
    
    // Set auth cookies
    if (data.session) {
      response.cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        httpOnly: true,
        secure: true, // Always secure in production
        sameSite: 'lax',
        maxAge: data.session.expires_in
      });
      
      response.cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        secure: true, // Always secure in production
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    return response;

  } catch (error: any) {
    console.error('[AUTH DEBUG] Server callback exception:', error);
    return NextResponse.redirect(new URL(`https://servio-production.up.railway.app/sign-in?error=server_exception&message=${error?.message || 'Unknown error'}`));
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    console.log('[AUTH DEBUG] Server-side callback handler started');
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');

    console.log('[AUTH DEBUG] Server callback params:', { 
      hasCode: !!code, 
      error, 
      errorDescription,
      hasState: !!state,
      allParams: Object.fromEntries(searchParams.entries())
    });

    // Check environment variables
    console.log('[AUTH DEBUG] Server environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });

    if (error) {
      console.error('[AUTH DEBUG] Server callback error:', { error, errorDescription });
      return NextResponse.redirect(new URL(`https://servio-production.up.railway.app/sign-in?error=oauth_error&description=${encodeURIComponent(errorDescription || '')}`));
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
          set: () => {},
          remove: () => {},
        },
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
        },
      }
    );

    console.log('[AUTH DEBUG] Exchanging code for session on server');
    
    // For server-side, pass the full URL for PKCE to include verifier via cookie
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(request.url);

    if (exchangeError) {
      console.error('[AUTH DEBUG] Server exchange error:', {
        message: exchangeError.message,
        status: exchangeError.status,
        name: exchangeError.name,
        stack: exchangeError.stack
      });
      return NextResponse.redirect(new URL(`https://servio-production.up.railway.app/sign-in?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`));
    }

    console.log('[AUTH DEBUG] Server exchange successful:', { 
      hasUser: !!data.user, 
      userId: data.user?.id,
      hasSession: !!data.session,
      sessionExpiresAt: data.session?.expires_at
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
    console.error('[AUTH DEBUG] Server callback exception:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      cause: error?.cause
    });
    
    // Provide more specific error messages based on the error type
    let userMessage = 'Server error during authentication';
    let errorCode = 'server_exception';
    
    if (error?.message?.includes('timeout')) {
      userMessage = 'Authentication timed out. Please try again.';
      errorCode = 'server_timeout';
    } else if (error?.message?.includes('network')) {
      userMessage = 'Network error. Please check your connection and try again.';
      errorCode = 'server_network_error';
    } else if (error?.message?.includes('fetch')) {
      userMessage = 'Connection error. Please try again.';
      errorCode = 'server_fetch_error';
    }
    
    return NextResponse.redirect(new URL(`https://servio-production.up.railway.app/sign-in?error=${errorCode}&message=${encodeURIComponent(userMessage)}`));
  }
}

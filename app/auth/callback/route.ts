import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function getOrigin(req: NextRequest) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const origin = getOrigin(req);

  console.log('[AUTH CALLBACK] === OAUTH CALLBACK STARTED ===');
  console.log('[AUTH CALLBACK] Request URL:', req.url);
  console.log('[AUTH CALLBACK] Origin:', origin);
  console.log('[AUTH CALLBACK] Code present:', !!code);
  console.log('[AUTH CALLBACK] Error present:', !!error);
  console.log('[AUTH CALLBACK] Error description:', errorDescription);

  // Handle OAuth errors
  if (error) {
    console.error('[AUTH CALLBACK] OAuth error received:', { error, errorDescription });
    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error('[AUTH CALLBACK] No authorization code received');
    return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
  }

  const cookieStore = await cookies();
  
  // Log existing cookies for debugging
  const existingCookies = cookieStore.getAll();
  console.log('[AUTH CALLBACK] Existing cookies before exchange:', 
    existingCookies.map(c => ({ name: c.name, hasValue: !!c.value }))
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { 
          const cookie = cookieStore.get(name);
          console.log('[AUTH CALLBACK] Getting cookie:', name, !!cookie?.value);
          return cookie?.value; 
        },
        set(name: string, value: string, options: any) {
          console.log('[AUTH CALLBACK] Setting cookie:', name, 'length:', value.length, 'options:', options);
          // Ensure secure and httpOnly settings for production
          const cookieOptions = {
            ...options,
            sameSite: 'lax' as const,
            secure: true,
            httpOnly: true,
            path: '/',
            maxAge: options.maxAge || 60 * 60 * 24 * 7, // 7 days default
          };
          cookieStore.set(name, value, cookieOptions);
        },
        remove(name: string, options: any) {
          console.log('[AUTH CALLBACK] Removing cookie:', name);
          cookieStore.set(name, '', { 
            ...options, 
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            secure: true,
            httpOnly: true
          });
        },
      },
    }
  );

  try {
    console.log('[AUTH CALLBACK] Exchanging code for session...');
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError);
      
      // Log to debug endpoint
      try {
        await fetch(`${origin}/api/auth/debug-oauth`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 
            action: 'EXCHANGE_ERROR', 
            data: { 
              message: exchangeError.message,
              status: exchangeError.status,
              name: exchangeError.name
            } 
          }),
        });
      } catch (debugError) {
        console.error('[AUTH CALLBACK] Failed to send debug log:', debugError);
      }

      return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent(exchangeError.message)}`);
    }

    console.log('[AUTH CALLBACK] Session exchange successful');
    console.log('[AUTH CALLBACK] User ID:', data.user?.id);
    console.log('[AUTH CALLBACK] User email:', data.user?.email);
    console.log('[AUTH CALLBACK] Has access token:', !!data.session?.access_token);
    console.log('[AUTH CALLBACK] Has refresh token:', !!data.session?.refresh_token);

    // Verify session was created properly
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[AUTH CALLBACK] Session verification failed:', sessionError);
      return NextResponse.redirect(`${origin}/auth/error?reason=session_verification_failed`);
    }

    if (!sessionData.session) {
      console.error('[AUTH CALLBACK] No session after exchange');
      return NextResponse.redirect(`${origin}/auth/error?reason=no_session_after_exchange`);
    }

    // Log cookies after exchange
    const cookiesAfterExchange = cookieStore.getAll();
    console.log('[AUTH CALLBACK] Cookies after exchange:', 
      cookiesAfterExchange.map(c => ({ name: c.name, hasValue: !!c.value }))
    );

    console.log('[AUTH CALLBACK] Session verified successfully');
    console.log('[AUTH CALLBACK] Redirecting to dashboard...');

    // Create response with redirect
    const response = NextResponse.redirect(`${origin}/dashboard`);
    
    // Ensure all auth cookies are properly set in the response
    cookiesAfterExchange.forEach(cookie => {
      if (cookie.name.includes('-auth-token') || cookie.name.includes('sb-')) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }
    });

    return response;

  } catch (unexpectedError: any) {
    console.error('[AUTH CALLBACK] Unexpected error:', unexpectedError);
    
    // Log to debug endpoint
    try {
      await fetch(`${origin}/api/auth/debug-oauth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          action: 'UNEXPECTED_ERROR', 
          data: { 
            message: unexpectedError.message,
            stack: unexpectedError.stack
          } 
        }),
      });
    } catch (debugError) {
      console.error('[AUTH CALLBACK] Failed to send debug log:', debugError);
    }

    return NextResponse.redirect(`${origin}/auth/error?reason=${encodeURIComponent('unexpected_error')}`);
  }
}

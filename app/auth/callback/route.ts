export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getRequestOrigin } from '@/lib/origin';

// Use robust origin resolution to avoid localhost on Railway
function getOrigin(req: NextRequest) {
  return getRequestOrigin(req);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const origin = getOrigin(req);

  // ✅ Build absolute URLs yourself. Don't trust req.url host.
  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`);

  console.log('[AUTH CALLBACK] === OAUTH CALLBACK STARTED ===');
  console.log('[AUTH CALLBACK] Request URL:', req.url);
  console.log('[AUTH CALLBACK] Origin:', origin);
  console.log('[AUTH CALLBACK] Code present:', !!code);
  console.log('[AUTH CALLBACK] Error present:', !!error);
  console.log('[AUTH CALLBACK] Error description:', errorDescription);

  // Handle OAuth errors
  if (error) {
    console.error('[AUTH CALLBACK] OAuth error received:', { error, errorDescription });
    return redirect('/auth/error?reason=' + encodeURIComponent(errorDescription || error));
  }

  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
      },
      cookies: {
        get(name: string) { 
          const cookie = cookieStore.get(name);
          return cookie?.value; 
        },
        set(name: string, value: string, options: any) {
          // Enforce secure, Lax cookies in production
          const cookieOptions = {
            ...options,
            sameSite: 'lax' as const,
            secure: true,
            httpOnly: true,
            path: '/',
            maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
          };
          cookieStore.set(name, value, cookieOptions);
        },
        remove(name: string, options: any) {
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

  // ✅ If already signed in, avoid re-exchange (prevents 429s).
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('[AUTH CALLBACK] User already signed in, redirecting to dashboard');
    return redirect('/dashboard');
  }

  if (!code) {
    console.error('[AUTH CALLBACK] No authorization code received');
    // Some providers use access_token instead of code (hash vs query). If so, delegate to client page.
    const hasAccessToken = url.searchParams.get('access_token') || url.hash.includes('access_token=')
    if (hasAccessToken) {
      return redirect('/auth/callback')
    }
    return redirect('/auth/error?reason=missing_code');
  }

  try {
    console.log('[AUTH CALLBACK] Exchanging code for session...');
    
    // Single authoritative exchange on the server
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError);
      return redirect('/auth/error?reason=' + encodeURIComponent(exchangeError.message));
    }

    console.log('[AUTH CALLBACK] Session exchange successful');
    console.log('[AUTH CALLBACK] User ID:', data.user?.id);
    console.log('[AUTH CALLBACK] User email:', data.user?.email);

    // Verify session was created properly
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[AUTH CALLBACK] Session verification failed:', sessionError);
      return redirect('/auth/error?reason=session_verification_failed');
    }

    if (!sessionData.session) {
      console.error('[AUTH CALLBACK] No session after exchange');
      return redirect('/auth/error?reason=no_session_after_exchange');
    }

    console.log('[AUTH CALLBACK] Session verified successfully');
    console.log('[AUTH CALLBACK] Redirecting to dashboard...');

    return redirect('/dashboard');

  } catch (unexpectedError: any) {
    console.error('[AUTH CALLBACK] Unexpected error:', unexpectedError);
    return redirect('/auth/error?reason=' + encodeURIComponent('unexpected_error'));
  }
}

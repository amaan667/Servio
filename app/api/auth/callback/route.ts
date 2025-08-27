import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  console.log('[AUTH DEBUG] API callback route called');
  console.log('[AUTH DEBUG] URL:', request.url);
  console.log('[AUTH DEBUG] Search params:', Object.fromEntries(request.nextUrl.searchParams.entries()));
  console.log('[AUTH DEBUG] Headers:', Object.fromEntries(request.headers.entries()));
  
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const state = requestUrl.searchParams.get('state');
  
  // Add timeout for the entire callback process
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Authentication callback timeout')), 60000)
  );
  
      if (error) {
      console.log('[AUTH DEBUG] OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `https://servio-production.up.railway.app/?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`
      );
    }
  
      if (!code) {
      console.log('[AUTH DEBUG] No code received');
      return NextResponse.redirect(
        `https://servio-production.up.railway.app/?error=missing_code&message=No authentication code received`
      );
    }
  
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    console.log('[AUTH DEBUG] Exchanging code for session...');
    console.log('[AUTH DEBUG] Code length:', code?.length);
    console.log('[AUTH DEBUG] State:', state);
    console.log('[AUTH DEBUG] Code preview:', code?.substring(0, 20) + '...');
    
    // Log all cookies to debug PKCE state
    const allCookies = cookieStore.getAll();
    console.log('[AUTH DEBUG] All cookies:', allCookies.map(c => ({ name: c.name, value: c.value?.substring(0, 20) + '...' })));
    
    // Check for PKCE-related cookies
    const pkceCookies = allCookies.filter(c => 
      c.name.includes('pkce') || c.name.includes('verifier') || c.name.includes('code_verifier')
    );
    console.log('[AUTH DEBUG] PKCE cookies found:', pkceCookies.length);
    
    // Log all localStorage and sessionStorage keys for debugging
    console.log('[AUTH DEBUG] Checking for PKCE state in cookies and storage...');
    
    // Add timeout to the exchange process
    const exchangePromise = supabase.auth.exchangeCodeForSession(code);
    const { data, error: exchangeError } = await Promise.race([exchangePromise, timeoutPromise]) as any;
    
    if (exchangeError) {
      console.log('[AUTH DEBUG] Exchange error:', exchangeError);
      
      // Handle timeout specifically
      if (exchangeError.message.includes('timeout') || exchangeError.message.includes('Authentication callback timeout')) {
        return NextResponse.redirect(
          `https://servio-production.up.railway.app/?error=timeout&message=Authentication timed out. Please try again.`
        );
      }
      
      // Handle specific PKCE error
      if (exchangeError.message.includes('code verifier should be non-empty') || 
          exchangeError.message.includes('both auth code and code verifier should be non-empty')) {
        console.log('[AUTH DEBUG] PKCE error detected - redirecting to home');
        return NextResponse.redirect(
          `https://servio-production.up.railway.app/?error=pkce_failed&message=Authentication flow interrupted. Please try signing in again.`
        );
      }
      
      return NextResponse.redirect(
        `https://servio-production.up.railway.app/?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`
      );
    }
    
    if (!data.session) {
      console.log('[AUTH DEBUG] No session after exchange');
      return NextResponse.redirect(
        `https://servio-production.up.railway.app/?error=no_session&message=No session created after authentication`
      );
    }
    
    console.log('[AUTH DEBUG] Authentication successful:', {
      userId: data.session.user?.id,
      userEmail: data.session.user?.email,
      sessionExpiresAt: data.session.expires_at
    });
    
    console.log('[AUTH DEBUG] Redirecting to home page');
    return NextResponse.redirect(`https://servio-production.up.railway.app/`);
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] Unexpected error:', error);
    console.log('[AUTH DEBUG] Error stack:', error.stack);
    console.log('[AUTH DEBUG] Error name:', error.name);
    
    let errorMessage = 'Unknown error occurred during authentication';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.name) {
      errorMessage = `${error.name}: ${errorMessage}`;
    }
    
    // Handle timeout specifically
    if (errorMessage.includes('timeout') || errorMessage.includes('Authentication callback timeout')) {
      return NextResponse.redirect(
        `${requestUrl.origin}/?error=timeout&message=Authentication timed out. Please try again.`
      );
    }
    
    return NextResponse.redirect(
      `https://servio-production.up.railway.app/?error=unexpected_error&message=${encodeURIComponent(errorMessage)}`
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getRequestBaseUrl } from '@/lib/getBaseUrl';

function cookieAdapter(jar: any) {
  return {
    get: (name: string) => jar.get(name)?.value,
    set: (name: string, value: string, options?: any) =>
      jar.set(name, value, {
        ...options,
  path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      }),
    remove: (name: string, options?: any) =>
      jar.set(name, '', {
        ...options,
  path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 0,
      }),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const hdrs: any = await headers();
  const baseOrigin = getRequestBaseUrl(hdrs as any);

  console.log('[AUTH] callback starting', {
    hasCode: !!code,
    hasError: !!error,
    base: baseOrigin,
  });

  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=oauth_error', baseOrigin));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', baseOrigin));
  }

  const jar = await cookies();
  // Diagnostic: list relevant cookies
  try {
    const all = jar.getAll?.() || [];
    const authCookieNames = all.map((c: any) => c.name);
    console.log('[AUTH][DEBUG] Incoming auth cookies:', authCookieNames);
    
    // Check for PKCE verifier in localStorage (via script)
    jar.set('_check_pkce', 'true', { path: '/', maxAge: 30 });
    
    // Check for Supabase auth cookies
    const sbCookies = all.filter((c: any) => c.name.startsWith('sb-'));
    console.log('[AUTH][DEBUG] Supabase auth cookies:', sbCookies.map((c: any) => c.name));
  } catch (e) {
    console.error('[AUTH][DEBUG] Error checking cookies:', e);
  }

  // Proactively clear stale access/refresh tokens (NOT the PKCE verifier cookie) to avoid refresh attempts before exchange
  try {
    const stale = ['sb-access-token','sb-refresh-token'];
    stale.forEach(n => jar.set(n, '', { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 0 }));
  } catch {}

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      cookies: cookieAdapter(jar),
      auth: {
        persistSession: true,
        flowType: 'pkce',
        autoRefreshToken: true,
        detectSessionInUrl: false // Important: don't detect in URL, we'll handle it ourselves
      }
    }
  );

  // Only exchange here. Do not exchange anywhere else (middleware, other routes, etc.).
  let exchanged = false;
  try {
    // Log PKCE verifier state before exchange
    const pkceDebug = typeof window !== 'undefined' ? 
      { 
        verifier: localStorage.getItem('supabase.auth.token-code-verifier'),
        hasVerifier: !!localStorage.getItem('supabase.auth.token-code-verifier')
      } : 
      { verifier: 'server-side', hasVerifier: true };
    
    console.log('[AUTH][DEBUG] PKCE state before exchange:', pkceDebug);
    
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    exchanged = !exchangeError && !!data?.session;
    
    if (exchangeError) {
      console.error('[AUTH] exchange failed:', exchangeError);
      const msg = exchangeError.message || '';
      
      // Normalize refresh token reuse / not found conditions
      if (/refresh token/i.test(msg) || /already used/i.test(msg) || /not found/i.test(msg) || /refresh_token/i.test(msg)) {
        console.log('[AUTH][DEBUG] Refresh token error detected, clearing cookies and redirecting');
        
        // Clean cookies to avoid looping on stale verifier
        try {
          const cookieStore: any = await cookies();
          const allCookies = cookieStore.getAll?.() || [];
          
          // Clear all auth cookies except PKCE verifier
          allCookies.forEach((c: any) => {
            if (c.name.startsWith('sb-') && !c.name.includes('code-verifier')) {
              try { 
                cookieStore.set(c.name, '', { 
                  path:'/', 
                  maxAge:0, 
                  secure:true, 
                  sameSite:'lax', 
                  httpOnly:true 
                }); 
              } catch (e) {
                console.error('[AUTH][DEBUG] Error clearing cookie:', c.name, e);
              }
            }
          });
        } catch (e) {
          console.error('[AUTH][DEBUG] Error clearing cookies:', e);
        }
        return NextResponse.redirect(new URL('/sign-in?error=session_expired', baseOrigin));
      }
      if (/code verifier/i.test(msg) || /code and code verifier should be non-empty/i.test(msg) || /validation_failed/i.test(msg)) {
        // PKCE missing or invalid; clear PKCE-related cookies and localStorage
        try {
          const cookieStore: any = await cookies();
          const allCookies = cookieStore.getAll?.() || [];
          
          // Clear PKCE-related cookies (more specific than heuristic)
          allCookies.forEach((c: any) => {
            if (c.name.includes('verifier') || c.name.includes('pkce') || c.name.includes('code') || c.name.includes('token-code')) {
              try { cookieStore.set(c.name, '', { path:'/', maxAge:0, secure:true, sameSite:'lax', httpOnly:true }); } catch {}
            }
          });
          
          // Also clear localStorage PKCE verifier if accessible (though this is server-side)
          console.log('[AUTH][DEBUG] Cleared PKCE-related cookies, redirecting to restart');
        } catch {}
        return NextResponse.redirect(new URL('/sign-in?error=pkce_restart', baseOrigin));
      }
      return NextResponse.redirect(new URL('/sign-in?error=oauth_exchange_failed', baseOrigin));
    }
  } catch (err) {
    console.error('[AUTH] unexpected exchange exception', err);
    return NextResponse.redirect(new URL('/sign-in?error=unexpected_error', baseOrigin));
  }
  // Try to fetch user and their first venue to deep-link if possible
  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.warn('[AUTH] getUser error after exchange', userErr);
    }
    if (user) {
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);
      const venueId = venues?.[0]?.venue_id as string | undefined;
      const dest = venueId ? `/dashboard/${venueId}` : next;
    return NextResponse.redirect(new URL(dest, baseOrigin));
    }
  } catch (e) {
    console.warn('[AUTH] callback post-exchange redirect fallback', e);
  }
  return NextResponse.redirect(new URL(next, baseOrigin));
}

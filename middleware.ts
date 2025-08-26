import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { clearAuthTokens, isInvalidTokenError } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const hasCode = url.searchParams.has("code");

  // Always allow OAuth callback and any request that carries the code param
  if (pathname.startsWith("/auth/callback") || hasCode) {
    console.log('[AUTH DEBUG] Middleware: allowing OAuth callback/code request', { pathname, hasCode });
    return NextResponse.next();
  }

  const res = NextResponse.next();
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value);
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Handle invalid refresh token errors gracefully
    if (error && isInvalidTokenError(error)) {
      console.log('[AUTH DEBUG] Middleware: clearing invalid refresh token');
      clearAuthTokens(res);
      
      // If this is a protected route, redirect to sign-in
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/settings')) {
        console.log('[AUTH DEBUG] Middleware: redirecting to sign-in due to invalid token');
        return NextResponse.redirect(new URL('/sign-in?error=invalid_token', req.url));
      }
      
      return res;
    }
    
    console.log('[AUTH DEBUG] Middleware: session check', { 
      pathname, 
      hasSession: !!session, 
      userId: session?.user?.id,
      error: error?.message 
    });
    
    // Only try to refresh if we have a valid session and it's close to expiring
    if (session && session.expires_at) {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // Only refresh if token expires within 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000) {
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError && isInvalidTokenError(refreshError)) {
            console.log('[AUTH DEBUG] Middleware: refresh failed, clearing tokens');
            clearAuthTokens(res);
            
            // If this is a protected route, redirect to sign-in
            if (pathname.startsWith('/dashboard') || pathname.startsWith('/settings')) {
              return NextResponse.redirect(new URL('/sign-in?error=invalid_token', req.url));
            }
          }
        } catch (refreshError) {
          console.error('[AUTH DEBUG] Middleware: refresh error:', refreshError);
          if (isInvalidTokenError(refreshError)) {
            clearAuthTokens(res);
          }
        }
      }
    }
  } catch (error) {
    console.error('[AUTH DEBUG] Middleware error:', error);
    
    // If it's an invalid token error, clear tokens and don't break the request
    if (isInvalidTokenError(error)) {
      clearAuthTokens(res);
    }
  }
  
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};



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
    }
    
    console.log('[AUTH DEBUG] Middleware: session check', { 
      pathname, 
      hasSession: !!session, 
      userId: session?.user?.id,
      error: error?.message 
    });
    
    // Only try to refresh if we have a valid session
    if (session) {
      await supabase.auth.getSession();
    }
  } catch (error) {
    console.error('[AUTH DEBUG] Middleware error:', error);
    // Don't let middleware errors break the request
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};



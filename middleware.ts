import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  
  console.log('[AUTH DEBUG] Middleware processing:', { 
    pathname, 
    hasCode: searchParams.has('code'),
    hasError: searchParams.has('error'),
    cookies: Object.keys(req.cookies.getAll())
  });
  
  // Always allow static assets
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/favicon.ico') || 
      pathname.startsWith('/assets/')) {
    console.log('[AUTH DEBUG] Allowing static asset:', pathname);
    return NextResponse.next();
  }
  
  // Always allow auth callback
  if (pathname.startsWith('/auth/callback') || searchParams.has('code')) {
    console.log('[AUTH DEBUG] Allowing auth callback:', pathname);
    return NextResponse.next();
  }
  
  // For dashboard protection, only check for refresh token cookie
  if (pathname.startsWith('/dashboard')) {
    const hasRefreshToken = req.cookies.has('sb-refresh-token') || 
                           req.cookies.has('sb-access-token');
    
    console.log('[AUTH DEBUG] Dashboard access check:', { 
      pathname, 
      hasRefreshToken,
      hasRefreshCookie: req.cookies.has('sb-refresh-token'),
      hasAccessCookie: req.cookies.has('sb-access-token')
    });
    
    if (!hasRefreshToken) {
      console.log('[AUTH DEBUG] No auth cookies, redirecting to sign-in');
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  console.log('[AUTH DEBUG] Middleware allowing request:', pathname);
  return NextResponse.next();
}



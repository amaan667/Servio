import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  
  // Always allow static assets
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/favicon.ico') || 
      pathname.startsWith('/assets/')) {
    return NextResponse.next();
  }
  
  // Always allow auth callback
  if (pathname.startsWith('/auth/callback') || searchParams.has('code')) {
    return NextResponse.next();
  }
  
  // For dashboard protection, only check for refresh token cookie
  if (pathname.startsWith('/dashboard')) {
    const hasRefreshToken = req.cookies.has('sb-refresh-token') || 
                           req.cookies.has('sb-access-token');
    
    if (!hasRefreshToken) {
      const url = req.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}



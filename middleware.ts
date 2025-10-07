import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard'];
const AUTH_ROUTES = ['/sign-in', '/sign-up', '/auth/callback'];
const PUBLIC_ORDER_ROUTES = ['/order'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  console.log('[MIDDLEWARE DEBUG] Processing request', {
    pathname,
    timestamp: new Date().toISOString(),
    cookies: req.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
  });
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/api/') || 
      pathname.startsWith('/favicon.ico')) {
    console.log('[MIDDLEWARE DEBUG] Skipping middleware for static/API route');
    return NextResponse.next();
  }
  
  // Check if the route is protected
  const isProtectedRoute = PROTECTED.some(p => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some(p => pathname.startsWith(p));
  const isPublicOrderRoute = PUBLIC_ORDER_ROUTES.some(p => pathname.startsWith(p));
  
  console.log('[MIDDLEWARE DEBUG] Route classification', {
    isProtectedRoute,
    isAuthRoute,
    isPublicOrderRoute,
  });
  
  // Allow public order routes (customers can access order pages without auth)
  if (isPublicOrderRoute) {
    console.log('[MIDDLEWARE DEBUG] Allowing public order route');
    return NextResponse.next();
  }
  
  if (!isProtectedRoute) {
    console.log('[MIDDLEWARE DEBUG] Not a protected route, allowing access');
    return NextResponse.next();
  }

  // Check for auth cookies
  const hasAuth = req.cookies.getAll().some(c =>
    c.name.startsWith('sb-') ||
    c.name.startsWith('supabase.auth.token') ||
    c.name.startsWith('supabase-auth-token')
  );
  
  console.log('[MIDDLEWARE DEBUG] Auth check result', {
    hasAuth,
    willRedirect: !hasAuth,
  });
  
  if (!hasAuth) {
    console.log('[MIDDLEWARE DEBUG] No auth found, redirecting to sign-in');
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
  
  console.log('[MIDDLEWARE DEBUG] Auth found, allowing access to protected route');
  // For protected routes with auth, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
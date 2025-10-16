import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard'];
const PUBLIC_ORDER_ROUTES = ['/order'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/api/') || 
      pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }
  
  // Check if the route is protected
  const isProtectedRoute = PROTECTED.some(p => pathname.startsWith(p));
  const isPublicOrderRoute = PUBLIC_ORDER_ROUTES.some(p => pathname.startsWith(p));
  
  // Allow public order routes (customers can access order pages without auth)
  if (isPublicOrderRoute || !isProtectedRoute) {
    return NextResponse.next();
  }

  // Allow access to all protected routes
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
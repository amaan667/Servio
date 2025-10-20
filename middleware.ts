import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_MATCHER = [
  '/dashboard',
  '/api',
];

const PUBLIC_ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/sign-out',
  '/auth',
  '/order',
  '/order-tracking',
  '/order-summary',
  '/checkout',
  '/payment',
  '/demo',
  '/cookies',
  '/privacy',
  '/terms',
  '/refund-policy',
];

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Allow public assets and auth routes
  if (
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico') || 
    path.startsWith('/robots.txt') ||
    path.startsWith('/manifest.json') ||
    path.startsWith('/sw.js')
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => path.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = PROTECTED_MATCHER.some(m => path.startsWith(m));
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // For protected routes, verify authentication
  const res = NextResponse.next();
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => {
            const value = req.cookies.get(name)?.value;
            return value;
          },
          set: (name, value, options) => {
            res.cookies.set(name, value, options);
          },
          remove: (name) => {
            res.cookies.delete(name);
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Only redirect to sign-in if there's no user AND no error (meaning user is genuinely not logged in)
    // If there's an error, let the page handle it - don't force redirect
    if (!user && !error) {
      const redirect = new URL('/sign-in', req.url);
      redirect.searchParams.set('next', encodeURIComponent(path));
      return NextResponse.redirect(redirect);
    }

    // If there's an error but no user, log it but don't redirect - let the page handle it
    if (error && !user) {
      console.warn('[MIDDLEWARE] Auth error detected but not redirecting:', error.message);
      // Allow the request to proceed - the page will handle the auth state
      return res;
    }

    return res;
  } catch (error) {
    console.error('[MIDDLEWARE] Error during auth check:', error);
    // Don't redirect on errors - let the page handle it
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)'],
};
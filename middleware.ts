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
            return req.cookies.get(name)?.value;
          },
          set: (name, value, options) => {
            res.cookies.set(name, value, options);
          },
          remove: (name) => {
            res.cookies.delete(name);
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    await supabase.auth.getUser();

    return res;
  } catch {
    // Don't redirect on errors - let the page handle it
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)'],
};

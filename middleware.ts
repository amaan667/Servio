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

  console.log('[MIDDLEWARE] Request:', {
    path,
    method: req.method,
    cookies: Object.keys(req.cookies.getAll()),
    timestamp: new Date().toISOString()
  });

  // Allow public assets and auth routes
  if (
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico') || 
    path.startsWith('/robots.txt') ||
    path.startsWith('/manifest.json') ||
    path.startsWith('/sw.js')
  ) {
    console.log('[MIDDLEWARE] Allowing public asset:', path);
    return NextResponse.next();
  }

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => path.startsWith(route));
  if (isPublicRoute) {
    console.log('[MIDDLEWARE] Allowing public route:', path);
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = PROTECTED_MATCHER.some(m => path.startsWith(m));
  if (!isProtectedRoute) {
    console.log('[MIDDLEWARE] Not a protected route:', path);
    return NextResponse.next();
  }

  console.log('[MIDDLEWARE] Protected route detected:', path);

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
            console.log('[MIDDLEWARE] Cookie get:', name, value ? 'present' : 'missing');
            return value;
          },
          set: (name, value, options) => {
            console.log('[MIDDLEWARE] Cookie set:', name);
            res.cookies.set(name, value, options);
          },
          remove: (name, options) => {
            console.log('[MIDDLEWARE] Cookie remove:', name);
            res.cookies.delete(name);
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    console.log('[MIDDLEWARE] Auth check result:', {
      hasUser: !!user,
      userId: user?.id,
      error: error?.message,
      path
    });
    
    if (!user) {
      console.log('[MIDDLEWARE] No user found, redirecting to sign-in');
      const redirect = new URL('/sign-in', req.url);
      redirect.searchParams.set('next', encodeURIComponent(path));
      return NextResponse.redirect(redirect);
    }

    console.log('[MIDDLEWARE] User authenticated, allowing access:', user.id);
    return res;
  } catch (error) {
    console.error('[MIDDLEWARE] Error during auth check:', error);
    const redirect = new URL('/sign-in', req.url);
    redirect.searchParams.set('error', 'auth_error');
    return NextResponse.redirect(redirect);
  }
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)'],
};
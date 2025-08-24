import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession();

  // If accessing a protected route without a session, redirect to sign-in
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard') || 
                          req.nextUrl.pathname.startsWith('/settings') ||
                          req.nextUrl.pathname.startsWith('/generate-qr');
  
  const isPublicRoute = req.nextUrl.pathname === '/' || 
                       req.nextUrl.pathname === '/sign-in' || 
                       req.nextUrl.pathname === '/sign-up' ||
                       req.nextUrl.pathname.startsWith('/order');

  if (!session && isProtectedRoute && !isPublicRoute) {
    console.log('[MIDDLEWARE] No session, redirecting to sign-in from:', req.nextUrl.pathname);
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  return response;
}



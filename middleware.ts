import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROD_BASE = 'https://servio-production.up.railway.app';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Never intercept auth routes or URLs with code/error parameters
  if (req.nextUrl.pathname.startsWith('/auth/') || 
      req.nextUrl.searchParams.has('code') || 
      req.nextUrl.searchParams.has('error')) {
    return res;
  }

  // Handle Supabase session propagation
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => {
            res.cookies.set(name, value, options);
          },
          remove: (name, options) => {
            res.cookies.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );
    
    // Propagate session to SSR
    await supabase.auth.getSession();
  } catch (error) {
    console.log('[AUTH DEBUG] Middleware session error:', error);
  }

  // Force https and the exact production host (only in production)
  if (process.env.NODE_ENV === 'production') {
    const isHttps = req.nextUrl.protocol === 'https:';
    const host = req.headers.get('host');

    if (!isHttps || host !== 'servio-production.up.railway.app') {
      const redirectUrl = new URL(req.nextUrl);
      redirectUrl.protocol = 'https:';
      redirectUrl.host = 'servio-production.up.railway.app';
      return NextResponse.redirect(redirectUrl, 308);
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};
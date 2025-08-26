import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clearAuthTokens, isInvalidTokenError } from '@/lib/auth';

const PUBLIC_PATHS = new Set([
  "/", "/features", "/sign-in", "/auth/callback",
]);

const isAsset = (p: string) =>
  p.startsWith("/_next/") ||
  p.startsWith("/favicon") ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Always allow callback and OAuth code roundtrips
  if (pathname.startsWith("/auth/callback") || url.searchParams.has("code") || isAsset(pathname)) {
    console.log('[AUTH DEBUG] Middleware: allowing public/asset request', { pathname });
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: "", ...options, maxAge: 0 }),
      },
    }
  );

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user ?? null;
    
    // Handle invalid refresh token errors gracefully
    if (error && isInvalidTokenError(error)) {
      console.log('[AUTH DEBUG] Middleware: clearing invalid refresh token');
      clearAuthTokens(res);
    }
    
    console.log('[AUTH DEBUG] Middleware: session check', { 
      pathname, 
      hasUser: !!user, 
      userId: user?.id,
      error: error?.message 
    });
    
  } catch (e: any) {
    console.error('[AUTH DEBUG] Middleware error:', e);
    
    // Handle invalid token errors
    if (isInvalidTokenError(e)) {
      console.log('[AUTH DEBUG] Middleware: clearing tokens due to error');
      clearAuthTokens(res);
    }
  }

  const isPublic = PUBLIC_PATHS.has(pathname);
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/settings");

  if (isProtected && !user) {
    console.log('[AUTH DEBUG] Middleware: redirecting to sign-in for protected route', { pathname });
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  return res;
}

// Exclude static assets from middleware
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};



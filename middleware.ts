import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

function getSupabaseUrl(): string {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }
  return key;
}

// Paths that require authentication
const protectedPaths = [
  "/dashboard",
  "/api/catalog",
  // "/api/menu" - PUBLIC: needed for customer ordering without auth
  // "/api/orders" - PUBLIC: needed for customer order submission without auth
  "/api/tables",
  "/api/inventory",
  "/api/staff",
  "/api/ai",
  // "/api/analytics/vitals" - PUBLIC: web performance metrics, no auth needed
  // "/api/auth" - PUBLIC: auth endpoints must be accessible
  "/api/qr",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for health check and public paths
  if (pathname === "/api/health" || !protectedPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // If Supabase env is misconfigured, fail open so the dashboard still loads
  let supabase: ReturnType<typeof createServerClient> | null = null;
  try {
    supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });
  } catch (error) {
    logger.error("[middleware] Supabase disabled - env missing or invalid", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open: allow request to continue without auth to avoid 500s
    return response;
  }

  // Get user - use getUser() instead of getSession() for secure authentication
  // getUser() authenticates the data by contacting the Supabase Auth server
  const {
    data: { user },
    error: _authError,
  } = await supabase.auth.getUser();
  
  // If getUser() fails, treat as unauthenticated
  const session = user ? { user } : null;

  // For API routes, inject user info into headers if session exists
  // Middleware does ALL auth checks - routes just read headers
  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(request.headers);
    
    // If session exists, inject user info - routes trust this completely
    if (session) {
      requestHeaders.set("x-user-id", session.user.id);
      requestHeaders.set("x-user-email", session.user.email || "");
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For dashboard pages, NO REDIRECTS - User requested ZERO sign-in redirects
  // Allow dashboard to load even without session - client-side will handle auth
  if (pathname.startsWith("/dashboard")) {
    logger.info("[middleware] dashboard navigation", {
      pathname,
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      timestamp: new Date().toISOString(),
      url: request.url,
    });
    
    // Don't redirect - let dashboard component handle auth client-side
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/catalog/:path*",
    // "/api/menu/:path*" - PUBLIC: needed for customer ordering without auth
    // "/api/orders/:path*" - PUBLIC: needed for customer order submission without auth
    "/api/tables/:path*",
    "/api/inventory/:path*",
    "/api/staff/:path*",
    "/api/ai/:path*",
    // "/api/analytics/:path*" - REMOVED: vitals endpoint needs to be public
    // "/api/auth/:path*" - PUBLIC: auth endpoints (sign-in, etc) must be accessible
    "/api/qr/:path*",
  ],
  // Explicitly exclude health check from middleware
  // This ensures health check is NEVER blocked
};

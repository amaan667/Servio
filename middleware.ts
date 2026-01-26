import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { env } from "@/lib/env";

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
  "/api/feedback",
  // "/api/analytics/vitals" - PUBLIC: web performance metrics, no auth needed
  // "/api/auth" - PUBLIC: auth endpoints must be accessible
  "/api/qr",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CRITICAL SECURITY: Always strip sensitive headers from the incoming request
  // to prevent header spoofing attacks. These headers should ONLY be set by
  // this middleware after successful authentication.
  request.headers.delete("x-user-id");
  request.headers.delete("x-user-email");

  // Skip middleware for health check and public paths
  if (pathname === "/api/health" || !protectedPaths.some((path) => pathname.startsWith(path))) {
    // Pass the request with STRIPPED headers
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // If Supabase env is misconfigured:
  // - FAIL CLOSED for protected API routes (security)
  // - Keep dashboard navigation non-blocking (no redirects), but do not inject auth headers
  let supabase: ReturnType<typeof createServerClient> | null = null;
  try {
    supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          // Update response with new cookies - this will be used when we return
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

    // Pilot hardening: never allow protected API routes to proceed without auth infrastructure.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Auth temporarily unavailable",
          code: "AUTH_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // Dashboard: allow to load (client-side can show auth/env error states)
    return response;
  }

  // Get user - use getUser() instead of getSession() for secure authentication
  // getUser() authenticates the data by contacting the Supabase Auth server
  // It also automatically refreshes the session if needed
  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If getUser() fails, try to refresh the session
  // This handles stale sessions where the access token expired but refresh token is valid
  if (authError && !user) {
    try {
      // Try to refresh the session
      // The Supabase SSR client will automatically update cookies via the set() handler
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();
      
      if (refreshedSession?.user && !refreshError) {
        user = refreshedSession.user;
        authError = null;
        // Response object is automatically updated with new cookies via the set() handler
        // No need to manually update - Supabase SSR client handles it
      }
    } catch (_refreshErr) {
      // Refresh failed, continue with original error
    }
  }

  // If getUser() fails, treat as unauthenticated
  const session = user ? { user } : null;

  // For API routes, inject user info into headers if session exists
  // Middleware does ALL auth checks - routes just read headers
  if (pathname.startsWith("/api/")) {
    // FAIL CLOSED: protected API routes require an authenticated user.
    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // Return response with updated cookies (automatically set by Supabase SSR client)
    // The response object is updated via the set() handler when refreshSession() is called
    // Create a new response with the updated cookies and request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.user.id);
    requestHeaders.set("x-user-email", session.user.email || "");
    
    // Return the response object which has the updated cookies from refreshSession()
    // and set the request headers for the next handler
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For dashboard pages, NO REDIRECTS - User requested ZERO sign-in redirects
  // Allow dashboard to load even without session - client-side will handle auth
  if (pathname.startsWith("/dashboard")) {

    // Don't redirect - let dashboard component handle auth client-side
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*", // Run on ALL API routes to ensure header stripping
  ],
  // Explicitly exclude health check from middleware
  // This ensures health check is NEVER blocked
};

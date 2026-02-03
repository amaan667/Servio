import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Public API paths: no auth headers needed (middleware skips auth for these only)
// Every other /api/* and /dashboard/* gets middleware auth so x-user-id is always set when the user has a session.
// This ensures we never return 401 due to "middleware didn't run" - only when the user is genuinely not authenticated.
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/ping", "/api/ready"]);

function shouldRunAuth(pathname: string): boolean {
  if (PUBLIC_API_PATHS.has(pathname)) return false;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/dashboard")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CRITICAL SECURITY: Always strip sensitive headers from the incoming request
  request.headers.delete("x-user-id");
  request.headers.delete("x-user-email");
  request.headers.delete("x-user-tier");
  request.headers.delete("x-user-role");
  request.headers.delete("x-venue-id");

  // Only skip auth for explicit public paths; all other /api/* and /dashboard/* get auth
  if (!shouldRunAuth(pathname)) {
    return NextResponse.next({
      request: { headers: request.headers },
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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

  // Create middleware-specific Supabase client that properly uses request/response cookies
  // This is CRITICAL: middleware cannot use cookies() from next/headers - must use request.cookies
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const allCookies = request.cookies.getAll();
        return allCookies;
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Set on request for downstream reads in this request
          request.cookies.set(name, value);
          
          // MOBILE FIX: Use secure based on actual protocol, not just NODE_ENV
          // This ensures cookies work correctly on mobile browsers
          const isSecure = request.url.startsWith("https://") || process.env.NODE_ENV === "production";
          
          // Set on response to persist to browser
          // MOBILE FIX: Use more permissive cookie settings for mobile browsers
          response.cookies.set(name, value, {
            ...options,
            httpOnly: false, // Must be false for Supabase to read from client
            sameSite: "lax", // Use lax for better mobile compatibility
            secure: isSecure, // Use secure based on actual protocol
            path: "/",
            // MOBILE FIX: Add maxAge to ensure cookies persist on mobile
            maxAge: options.maxAge || 60 * 60 * 24 * 7, // 7 days default
          });
        });
      },
    },
  });

  // Get user - use getUser() instead of getSession() for secure authentication
  // getUser() authenticates the data by contacting the Supabase Auth server
  // It also automatically refreshes the session if needed

  // Check for Authorization header (client may send Bearer token from localStorage)
  // This handles the case where client session was refreshed but cookies haven't been updated
  const authHeader = request.headers.get("Authorization");
  let userFromAuthHeader: { id: string; email?: string } | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      // Verify the JWT token with Supabase
      const { data: userData, error: tokenError } = await supabase.auth.getUser(token);
      if (userData?.user && !tokenError) {
        userFromAuthHeader = userData.user;
      }
    } catch {
      // Token verification failed, fall back to cookie-based auth
    }
  }

  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If cookie-based auth failed but Authorization header had valid token, use that
  if ((!user || authError) && userFromAuthHeader) {
    user = userFromAuthHeader as typeof user;
    authError = null;
  }

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
  // SIMPLIFIED: Only set user-id/email. Unified handler will extract venueId and call RPC if needed.
  // This is more reliable than trying to extract venueId from URL patterns in middleware.
  if (pathname.startsWith("/api/")) {
    // Only set headers if we have a session - unified handler will check auth
    if (session) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", session.user.id);
      requestHeaders.set("x-user-email", session.user.email || "");

      // Note: Tier/role headers are set by unified handler after it extracts venueId
      // This is more reliable than trying to parse venueId from URL patterns here

      // Create new response with updated headers, preserving any cookies set during auth
      const newResponse = NextResponse.next({
        request: { headers: requestHeaders },
      });
      // Copy cookies from original response (set by Supabase during token refresh)
      response.cookies.getAll().forEach((cookie) => {
        newResponse.cookies.set(cookie.name, cookie.value);
      });
      return newResponse;
    }

    // No session - pass through without headers, let unified handler decide
    // This allows public routes (requireAuth: false) to work
    return response;
  }

  // Dashboard: auth/tier/role from middleware only (get_access_context RPC)
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return response;
    }

    const segments = pathname.split("/").filter(Boolean);
    const venueSegment = segments[1];
    if (!venueSegment) return response;

    const normalizedVenueId = venueSegment.startsWith("venue-")
      ? venueSegment
      : `venue-${venueSegment}`;

    try {
      // Verify we have an authenticated session before calling RPC
      const {
        data: { user: verifyUser },
        error: verifyError,
      } = await supabase.auth.getUser();

      if (!verifyUser) {
        return response;
      }

      // Call RPC with proper error handling
      // NOTE: In Edge/middleware, Supabase rpc() returns a promise-like object but does NOT
      // support chaining .catch() directly in all environments, so we use try/catch around await.
      let data: {
        user_id?: string;
        venue_id?: string | null;
        role?: string;
        tier?: string;
      } | null = null;
      let rpcErr: { message: string; code?: string; details?: unknown; hint?: unknown } | null =
        null;
      try {
        const result = await supabase.rpc("get_access_context", {
          p_venue_id: normalizedVenueId,
        });
        data = result.data;
        rpcErr = result.error;
      } catch (catchErr: unknown) {
        rpcErr = { message: "RPC call failed", code: "RPC_ERROR" };
        data = null;
      }

      // Always set basic user headers (user-id, email) even if RPC fails
      // This ensures pages know user is authenticated, even if tier/role unavailable
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", verifyUser.id);
      requestHeaders.set("x-user-email", session.user.email || "");

      // When cookie-based RPC fails (e.g. mobile), retry with access_token so tier/role are correct
      let ctx: { user_id?: string; venue_id?: string | null; role?: string; tier?: string } | null =
        data as typeof data;
      if (rpcErr || !data) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          const tokenClient = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: { getAll: () => [], setAll: () => {} },
            global: {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          });
          const retry = await tokenClient.rpc("get_access_context", {
            p_venue_id: normalizedVenueId,
          });
          if (!retry.error && retry.data?.user_id && retry.data?.role) {
            ctx = retry.data as typeof ctx;
          }
        }
        if (!ctx) {
          requestHeaders.set("x-user-id", verifyUser.id);
          requestHeaders.set("x-user-email", session.user.email || "");
          requestHeaders.set("x-venue-id", normalizedVenueId);
          requestHeaders.set("x-user-tier", "starter");
          requestHeaders.set("x-user-role", "owner");
          const fallbackResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.getAll().forEach((c) => fallbackResponse.cookies.set(c.name, c.value));
          return fallbackResponse;
        }
      }

      // Validate RPC response structure - must have user_id and role (ctx may be from retry)
      if (!ctx!.user_id || !ctx!.role) {
        requestHeaders.set("x-user-id", verifyUser.id);
        requestHeaders.set("x-user-email", session.user.email || "");
        requestHeaders.set("x-venue-id", normalizedVenueId);
        requestHeaders.set("x-user-tier", "starter");
        requestHeaders.set("x-user-role", "owner");
        const invalidResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => invalidResponse.cookies.set(c.name, c.value));
        return invalidResponse;
      }

      // Validate tier is one of the valid values
      const tier = ctx!.tier?.toLowerCase().trim() || "starter";
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        requestHeaders.set("x-user-id", ctx!.user_id);
        requestHeaders.set("x-user-email", session.user.email || "");
        requestHeaders.set("x-user-tier", "starter");
        requestHeaders.set("x-user-role", ctx!.role);
        requestHeaders.set("x-venue-id", ctx!.venue_id ?? normalizedVenueId);
        const tierResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => tierResponse.cookies.set(c.name, c.value));
        return tierResponse;
      }

      // RPC succeeded (or retry with token) - set headers with actual tier/role from database
      requestHeaders.set("x-user-id", ctx!.user_id);
      requestHeaders.set("x-user-email", session.user.email || "");
      requestHeaders.set("x-user-tier", tier);
      requestHeaders.set("x-user-role", ctx!.role);
      requestHeaders.set("x-venue-id", ctx!.venue_id ?? normalizedVenueId);

      const successResponse = NextResponse.next({
        request: { headers: requestHeaders },
      });
      // Preserve any cookies set during auth (e.g., token refresh)
      response.cookies.getAll().forEach((c) => successResponse.cookies.set(c.name, c.value));
      return successResponse;
    } catch (_error) {
      return response;
    }
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

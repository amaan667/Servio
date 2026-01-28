import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Paths that require authentication - middleware does ALL auth; routes read x-user-id only
const protectedPaths = [
  "/dashboard",
  "/api/catalog",
  "/api/kds", // KDS: middleware auth only; KDS rate limit on routes - no auth/rate-limit errors
  "/api/tables",
  "/api/inventory",
  "/api/staff",
  "/api/ai",
  "/api/feedback",
  "/api/qr",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CRITICAL SECURITY: Always strip sensitive headers from the incoming request
  request.headers.delete("x-user-id");
  request.headers.delete("x-user-email");
  request.headers.delete("x-user-tier");
  request.headers.delete("x-user-role");
  request.headers.delete("x-venue-id");

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.error("[MIDDLEWARE] Missing Supabase env vars", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    });
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
        // eslint-disable-next-line no-console
        console.log("[MIDDLEWARE] Reading cookies", {
          count: allCookies.length,
          names: allCookies.map(c => c.name).filter(n => n.includes("sb-")),
        });
        return allCookies;
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Set on request for downstream reads in this request
          request.cookies.set(name, value);
          // Set on response to persist to browser
          response.cookies.set(name, value, {
            ...options,
            httpOnly: false, // Must be false for Supabase to read from client
            sameSite: "lax",
            secure: true,
            path: "/",
          });
        });
      },
    },
  });

  // Get user - use getUser() instead of getSession() for secure authentication
  // getUser() authenticates the data by contacting the Supabase Auth server
  // It also automatically refreshes the session if needed
  
  // First, log incoming cookies for debugging
  const cookieHeader = request.headers.get("cookie") || "";
  const hasAuthCookies = cookieHeader.includes("sb-") && cookieHeader.includes("auth-token");
  // eslint-disable-next-line no-console
  console.log("[MIDDLEWARE] Auth check starting", {
    pathname,
    hasAuthCookies,
    cookiePreview: cookieHeader.slice(0, 200) + (cookieHeader.length > 200 ? "..." : ""),
  });
  
  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // eslint-disable-next-line no-console
  console.log("[MIDDLEWARE] getUser() result", {
    pathname,
    hasUser: !!user,
    userId: user?.id,
    email: user?.email,
    authError: authError?.message,
    authErrorCode: authError?.status,
  });

  // If getUser() fails, try to refresh the session
  // This handles stale sessions where the access token expired but refresh token is valid
  if (authError && !user) {
    // eslint-disable-next-line no-console
    console.log("[MIDDLEWARE] Attempting session refresh due to auth error");
    try {
      // Try to refresh the session
      // The Supabase SSR client will automatically update cookies via the set() handler
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();
      
      // eslint-disable-next-line no-console
      console.log("[MIDDLEWARE] Session refresh result", {
        hasSession: !!refreshedSession,
        hasUser: !!refreshedSession?.user,
        refreshError: refreshError?.message,
      });
      
      if (refreshedSession?.user && !refreshError) {
        user = refreshedSession.user;
        authError = null;
        // eslint-disable-next-line no-console
        console.log("[MIDDLEWARE] Session refresh succeeded", {
          userId: user.id,
          email: user.email,
        });
        // Response object is automatically updated with new cookies via the set() handler
        // No need to manually update - Supabase SSR client handles it
      }
    } catch (_refreshErr) {
      // eslint-disable-next-line no-console
      console.error("[MIDDLEWARE] Session refresh exception", {
        error: _refreshErr instanceof Error ? _refreshErr.message : String(_refreshErr),
      });
      // Refresh failed, continue with original error
    }
  }

  // If getUser() fails, treat as unauthenticated
  const session = user ? { user } : null;
  
  // eslint-disable-next-line no-console
  console.log("[MIDDLEWARE] Final auth state", {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id,
  });

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
      response.cookies.getAll().forEach(cookie => {
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
      // eslint-disable-next-line no-console
      console.error("[MIDDLEWARE] ❌ Dashboard access with NO SESSION", {
        pathname,
        hasAuthCookies,
        authError: authError?.message,
        timestamp: new Date().toISOString(),
      });
      return response;
    }

    const segments = pathname.split("/").filter(Boolean);
    const venueSegment = segments[1];
    if (!venueSegment) return response;

    const normalizedVenueId = venueSegment.startsWith("venue-")
      ? venueSegment
      : `venue-${venueSegment}`;

    try {
      // eslint-disable-next-line no-console
      console.log("[MIDDLEWARE] Dashboard page - calling get_access_context", {
        pathname,
        venueId: normalizedVenueId,
        userId: session.user.id,
        email: session.user.email,
      });

      // Verify we have an authenticated session before calling RPC
      const { data: { user: verifyUser }, error: verifyError } = await supabase.auth.getUser();
      
      // eslint-disable-next-line no-console
      console.log("[MIDDLEWARE] Session verification", {
        hasUser: !!verifyUser,
        userId: verifyUser?.id,
        verifyError: verifyError?.message,
      });

      if (!verifyUser) {
        // eslint-disable-next-line no-console
        console.log("[MIDDLEWARE] No authenticated user for RPC call");
        return response;
      }

      // Call RPC with proper error handling
      // NOTE: In Edge/middleware, Supabase rpc() returns a promise-like object but does NOT
      // support chaining .catch() directly in all environments, so we use try/catch around await.
      let data: { user_id?: string; venue_id?: string | null; role?: string; tier?: string } | null =
        null;
      let rpcErr:
        | { message: string; code?: string; details?: unknown; hint?: unknown }
        | null = null;
      try {
        const result = await supabase.rpc("get_access_context", {
          p_venue_id: normalizedVenueId,
        });
        data = result.data;
        rpcErr = result.error;
      } catch (catchErr: unknown) {
        // eslint-disable-next-line no-console
        console.error("[MIDDLEWARE] RPC call exception", {
          error: catchErr instanceof Error ? catchErr.message : String(catchErr),
          stack: catchErr instanceof Error ? catchErr.stack : undefined,
        });
        rpcErr = { message: "RPC call failed", code: "RPC_ERROR" };
        data = null;
      }

      // eslint-disable-next-line no-console
      console.log("[MIDDLEWARE] get_access_context result", {
        hasData: !!data,
        hasError: !!rpcErr,
        error: rpcErr ? {
          message: rpcErr.message,
          code: rpcErr.code,
          details: rpcErr.details,
          hint: rpcErr.hint,
        } : null,
        data: data ? { 
          userId: data.user_id, 
          role: data.role, 
          tier: data.tier,
          venueId: data.venue_id,
        } : null,
      });

      // Always set basic user headers (user-id, email) even if RPC fails
      // This ensures pages know user is authenticated, even if tier/role unavailable
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", verifyUser.id);
      requestHeaders.set("x-user-email", session.user.email || "");

      if (rpcErr) {
        // eslint-disable-next-line no-console
        console.error("[MIDDLEWARE] RPC error - CRITICAL: get_access_context failed", {
          message: rpcErr.message,
          code: rpcErr.code,
          details: rpcErr.details,
          hint: rpcErr.hint,
          userId: verifyUser.id,
          venueId: normalizedVenueId,
        });
        // RPC failed - set basic headers so page knows user is authenticated
        // Page will handle missing tier/role gracefully
        requestHeaders.set("x-user-id", verifyUser.id);
        requestHeaders.set("x-user-email", session.user.email || "");
        requestHeaders.set("x-venue-id", normalizedVenueId);
        // Don't set tier/role - RPC failed, page should handle this
        const errResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach(c => errResponse.cookies.set(c.name, c.value));
        return errResponse;
      }

      if (!data) {
        // eslint-disable-next-line no-console
        console.error("[MIDDLEWARE] RPC returned no data - CRITICAL: user may not have access", {
          userId: verifyUser.id,
          venueId: normalizedVenueId,
        });
        // RPC returned null - set basic headers so page knows user is authenticated
        // Page will handle missing tier/role gracefully
        requestHeaders.set("x-user-id", verifyUser.id);
        requestHeaders.set("x-user-email", session.user.email || "");
        requestHeaders.set("x-venue-id", normalizedVenueId);
        // Don't set tier/role - RPC returned null, page should handle this
        const noDataResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach(c => noDataResponse.cookies.set(c.name, c.value));
        return noDataResponse;
      }

      // Validate RPC response structure
      // Validate RPC response structure - must have user_id and role
      const ctx = data as { user_id?: string; venue_id?: string | null; role?: string; tier?: string };
      
      if (!ctx.user_id || !ctx.role) {
        // eslint-disable-next-line no-console
        console.error("[MIDDLEWARE] CRITICAL: RPC returned invalid data structure", {
          hasUserId: !!ctx.user_id,
          hasRole: !!ctx.role,
          hasTier: !!ctx.tier,
          hasVenueId: !!ctx.venue_id,
          fullData: ctx,
          userId: verifyUser.id,
          venueId: normalizedVenueId,
        });
        // RPC returned invalid data - set basic headers, page handles missing tier/role
        requestHeaders.set("x-user-id", verifyUser.id);
        requestHeaders.set("x-user-email", session.user.email || "");
        requestHeaders.set("x-venue-id", normalizedVenueId);
        const invalidResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach(c => invalidResponse.cookies.set(c.name, c.value));
        return invalidResponse;
      }

      // Validate tier is one of the valid values
      const tier = (ctx.tier?.toLowerCase().trim() || "starter");
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        // eslint-disable-next-line no-console
        console.error("[MIDDLEWARE] CRITICAL: RPC returned invalid tier", {
          tier: ctx.tier,
          normalizedTier: tier,
          userId: verifyUser.id,
          venueId: normalizedVenueId,
        });
        // Invalid tier - set basic headers with default tier, page can handle
        requestHeaders.set("x-user-id", ctx.user_id);
        requestHeaders.set("x-user-email", session.user.email || "");
        requestHeaders.set("x-user-tier", "starter"); // Default to starter if invalid
        requestHeaders.set("x-user-role", ctx.role);
        requestHeaders.set("x-venue-id", ctx.venue_id ?? normalizedVenueId);
        const tierResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach(c => tierResponse.cookies.set(c.name, c.value));
        return tierResponse;
      }

      // RPC succeeded with valid data - set all headers with actual values from database
      requestHeaders.set("x-user-id", ctx.user_id);
      requestHeaders.set("x-user-email", session.user.email || "");
      requestHeaders.set("x-user-tier", tier); // Use validated tier from database
      requestHeaders.set("x-user-role", ctx.role);
      requestHeaders.set("x-venue-id", ctx.venue_id ?? normalizedVenueId);

      // Comprehensive logging - this will show in server logs
      // eslint-disable-next-line no-console
      console.log("[MIDDLEWARE] ========== SETTING DASHBOARD HEADERS ==========", {
        timestamp: new Date().toISOString(),
        pathname,
        userId: ctx.user_id,
        email: session.user.email,
        tier: tier,
        tierFromRPC: ctx.tier,
        role: ctx.role,
        venueId: ctx.venue_id ?? normalizedVenueId,
        normalizedVenueId,
        allHeaders: {
          "x-user-id": ctx.user_id,
          "x-user-email": session.user.email || "",
          "x-user-tier": tier,
          "x-user-role": ctx.role,
          "x-venue-id": ctx.venue_id ?? normalizedVenueId,
        },
      });

      const successResponse = NextResponse.next({
        request: { headers: requestHeaders },
      });
      // Preserve any cookies set during auth (e.g., token refresh)
      response.cookies.getAll().forEach(c => successResponse.cookies.set(c.name, c.value));
      return successResponse;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[MIDDLEWARE] Exception in dashboard auth", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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

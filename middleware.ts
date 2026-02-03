import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Public API paths: no auth headers needed
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/ping", "/api/ready"]);

function shouldRunAuth(pathname: string): boolean {
  if (PUBLIC_API_PATHS.has(pathname)) return false;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/dashboard")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CRITICAL SECURITY: Always strip sensitive headers from incoming request
  request.headers.delete("x-user-id");
  request.headers.delete("x-user-email");
  request.headers.delete("x-user-tier");
  request.headers.delete("x-user-role");
  request.headers.delete("x-venue-id");

  // Only skip auth for explicit public paths
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Auth temporarily unavailable",
          code: "AUTH_UNAVAILABLE",
        },
        { status: 503 }
      );
    }
    return response;
  }

  // MOBILE FIX: Detect mobile browser and adjust cookie settings
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  
  // MOBILE FIX: Use more permissive cookie settings for mobile browsers
  // iOS Safari requires: sameSite=lax, httpOnly=false, secure=true (on HTTPS)
  // Android Chrome requires: sameSite=lax or none, httpOnly=false
  const mobileCookieSettings: CookieOptions = {
    httpOnly: false, // Required for Supabase to read cookies
    sameSite: isMobile ? "lax" : "strict", // Lax for mobile, strict for desktop
    secure: request.url.startsWith("https://") || process.env.NODE_ENV === "production", // HTTPS on production
    path: "/", // Root path for all subdomains
    maxAge: 60 * 60 * 24 * 7, // 7 days for mobile persistence
  };

  // Create middleware-specific Supabase client
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
          
          // Set on response with mobile-optimized settings
          response.cookies.set(name, value, {
            ...options,
            ...mobileCookieSettings,
          });
        });
      },
    },
  });

  // Get user - use getUser() for secure authentication
  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Check for Authorization header (client may send Bearer token from localStorage)
  const authHeader = request.headers.get("Authorization");
  let userFromAuthHeader: { id: string; email?: string } | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const { data: userData, error: tokenError } = await supabase.auth.getUser(token);
      if (userData?.user && !tokenError) {
        userFromAuthHeader = userData.user;
      }
    } catch {
      // Token verification failed, fall back to cookie-based auth
    }
  }

  // If cookie-based auth failed but Authorization header had valid token, use that
  if ((!user || authError) && userFromAuthHeader) {
    user = userFromAuthHeader as typeof user;
    authError = null;
  }

  // If getUser() fails, try to refresh the session
  if (authError && !user) {
    try {
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshedSession?.user && !refreshError) {
        user = refreshedSession.user;
        authError = null;
      }
    } catch (_refreshErr) {
      // Refresh failed, continue with original error
    }
  }

  const session = user ? { user } : null;

  // For API routes, inject user info into headers if session exists
  if (pathname.startsWith("/api/")) {
    if (session) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", session.user.id);
      requestHeaders.set("x-user-email", session.user.email || "");

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
      // MOBILE FIX: Ensure headers are set even on mobile browsers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", verifyUser.id);
      requestHeaders.set("x-user-email", session.user.email || "");

      if (rpcErr) {
        // RPC failed - set default tier/role for mobile robustness
        requestHeaders.set("x-venue-id", normalizedVenueId);
        requestHeaders.set("x-user-tier", "starter");
        requestHeaders.set("x-user-role", "owner");
        
        const errResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => errResponse.cookies.set(c.name, c.value));
        return errResponse;
      }

      if (!data) {
        // RPC returned null - set default tier/role for mobile
        requestHeaders.set("x-venue-id", normalizedVenueId);
        requestHeaders.set("x-user-tier", "starter");
        requestHeaders.set("x-user-role", "owner");
        
        const noDataResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => noDataResponse.cookies.set(c.name, c.value));
        return noDataResponse;
      }

      // Validate RPC response structure
      const ctx = data as typeof data;
      if (!ctx?.user_id || !ctx?.role) {
        // RPC returned invalid data - set defaults for mobile
        requestHeaders.set("x-venue-id", normalizedVenueId);
        requestHeaders.set("x-user-tier", "starter");
        requestHeaders.set("x-user-role", "owner");
        
        const invalidResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => invalidResponse.cookies.set(c.name, c.value));
        return invalidResponse;
      }

      // Validate tier is one of valid values
      const tier = ctx?.tier?.toLowerCase().trim() || "starter";
      if (!["starter", "pro", "enterprise"].includes(tier)) {
        // Invalid tier - set default for mobile
        requestHeaders.set("x-venue-id", normalizedVenueId);
        requestHeaders.set("x-user-tier", "starter");
        requestHeaders.set("x-user-role", ctx?.role || "owner");
        
        const tierResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => tierResponse.cookies.set(c.name, c.value));
        return tierResponse;
      }

      // RPC succeeded (or retry with token) - set headers with actual tier/role from database
      requestHeaders.set("x-user-id", ctx.user_id);
      requestHeaders.set("x-user-email", session.user.email || "");
      requestHeaders.set("x-user-tier", tier);
      requestHeaders.set("x-user-role", ctx.role);
      requestHeaders.set("x-venue-id", ctx.venue_id ?? normalizedVenueId);

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
    "/api/:path*",
  ],
};

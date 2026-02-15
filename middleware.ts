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

/**
 * Helper: build a NextResponse that forwards `requestHeaders` and
 * preserves any cookies already set on `source` (e.g. token refresh).
 */
function forwardWithHeaders(
  requestHeaders: Headers,
  source: NextResponse
): NextResponse {
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  source.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
  return res;
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

  const mobileCookieSettings: CookieOptions = {
    httpOnly: false,
    sameSite: isMobile ? "lax" : "strict",
    secure: request.url.startsWith("https://") || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  // Create middleware-specific Supabase client
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, {
            ...options,
            ...mobileCookieSettings,
          });
        });
      },
    },
  });

  // ── Authenticate the user ──────────────────────────────────────────
  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Check for Authorization header (client may send Bearer token)
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
      // Token verification failed
    }
  }

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
    } catch {
      // Refresh failed
    }
  }

  const session = user ? { user } : null;

  // ── API routes ─────────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(request.headers);
    if (pathname.startsWith("/api/v1/")) {
      requestHeaders.set("x-api-version", "v1");
    }
    if (session) {
      requestHeaders.set("x-user-id", session.user.id);
      requestHeaders.set("x-user-email", session.user.email || "");

      // Try to resolve tier/role from RPC when venueId is in the query string.
      // If the RPC fails we do NOT fabricate values — downstream handlers
      // (withUnifiedAuth / createUnifiedHandler) will resolve from the DB.
      const url = new URL(request.url);
      const queryVenueId = url.searchParams.get("venueId") || url.searchParams.get("venue_id");
      if (queryVenueId) {
        const normalizedApiVenueId = queryVenueId.startsWith("venue-")
          ? queryVenueId
          : `venue-${queryVenueId}`;
        try {
          const { data: apiCtx, error: apiRpcErr } = await supabase.rpc("get_access_context", {
            p_venue_id: normalizedApiVenueId,
          });
          if (!apiRpcErr && apiCtx) {
            const apiRpc = apiCtx as { user_id?: string; role?: string; tier?: string };
            if (apiRpc.user_id && apiRpc.role && apiRpc.tier) {
              requestHeaders.set("x-user-tier", apiRpc.tier.toLowerCase().trim());
              requestHeaders.set("x-user-role", apiRpc.role);
              requestHeaders.set("x-venue-id", normalizedApiVenueId);
            }
          }
        } catch {
          // RPC failed — leave headers unset; downstream will resolve from DB
        }
      }

      return forwardWithHeaders(requestHeaders, response);
    }

    // No session
    if (pathname.startsWith("/api/v1/")) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-api-version", "v1");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return response;
  }

  // ── Dashboard routes ───────────────────────────────────────────────
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

    // Always build a fresh header set with the authenticated user id.
    // Role and tier are ONLY set when the RPC returns real DB data.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.user.id);
    requestHeaders.set("x-user-email", session.user.email || "");
    requestHeaders.set("x-venue-id", normalizedVenueId);

    try {
      const { data, error: rpcErr } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (!rpcErr && data) {
        const ctx = data as { user_id?: string; role?: string; tier?: string; venue_id?: string | null };

        if (ctx.user_id && ctx.role && ctx.tier) {
          const tier = ctx.tier.toLowerCase().trim();

          if (["starter", "pro", "enterprise"].includes(tier)) {
            requestHeaders.set("x-user-tier", tier);
            requestHeaders.set("x-user-role", ctx.role);
            if (ctx.venue_id) {
              requestHeaders.set("x-venue-id", ctx.venue_id);
            }
          }
          // If tier value is unrecognised we leave x-user-tier unset
          // so the page falls through to resolveVenueAccess (DB query).
        }
      }
      // If RPC failed or returned incomplete data we leave x-user-tier
      // and x-user-role unset. The page will call resolveVenueAccess.
    } catch {
      // RPC threw — headers stay without role/tier.
    }

    return forwardWithHeaders(requestHeaders, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};

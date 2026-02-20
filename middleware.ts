import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveApiRouteAccess } from "@/lib/api/route-access-policy";
import { normalizeVenueId } from "@/lib/utils/venueId";
import { logger } from "@/lib/monitoring/structured-logger";

function shouldRunAuth(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/dashboard")) return true;
  return false;
}

function withApiVersionHeader(pathname: string, headers: Headers): Headers {
  if (pathname.startsWith("/api/v1/")) {
    headers.set("x-api-version", "v1");
  }
  return headers;
}

function getSystemSecret(): string | null {
  return process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || null;
}

function isValidSystemRequest(request: NextRequest): { ok: boolean; reason?: "missing" | "invalid" } {
  const secret = getSystemSecret();
  if (!secret) {
    return { ok: false, reason: "missing" };
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const internalToken = request.headers.get("x-internal-secret");
  const cronToken = request.headers.get("x-cron-secret");

  if (bearerToken === secret || internalToken === secret || cronToken === secret) {
    return { ok: true };
  }

  return { ok: false, reason: "invalid" };
}

function redirectToSignIn(request: NextRequest, code?: "forbidden" | "auth_unavailable"): NextResponse {
  const url = new URL("/sign-in", request.url);
  const redirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.searchParams.set("redirect", redirectPath);

  if (code) {
    url.searchParams.set("reason", code);
  }

  return NextResponse.redirect(url);
}

function getOrCreateCorrelationId(request: NextRequest): string {
  return request.headers.get("x-correlation-id") || crypto.randomUUID();
}

/**
 * Helper: build a NextResponse that forwards `requestHeaders` and
 * preserves any cookies already set on `source` (e.g. token refresh).
 *
 * IMPORTANT: We copy the full cookie object (name, value, path, maxAge,
 * sameSite, etc.) — not just name+value. Dropping the options turned
 * refreshed auth cookies into session-only cookies that mobile browsers
 * evict aggressively, causing "not authenticated" errors after the tab
 * had been backgrounded.
 */
function forwardWithHeaders(requestHeaders: Headers, source: NextResponse): NextResponse {
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  source.cookies.getAll().forEach((c) => {
    res.cookies.set({
      name: c.name,
      value: c.value,
      path: c.path,
      domain: c.domain,
      maxAge: c.maxAge,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    });
  });
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const correlationId = getOrCreateCorrelationId(request);

  // Always strip sensitive context headers from incoming requests.
  const sanitizedHeaders = new Headers(request.headers);
  sanitizedHeaders.delete("x-user-id");
  sanitizedHeaders.delete("x-user-email");
  sanitizedHeaders.delete("x-user-tier");
  sanitizedHeaders.delete("x-user-role");
  sanitizedHeaders.delete("x-venue-id");
  sanitizedHeaders.set("x-correlation-id", correlationId);

  if (!shouldRunAuth(pathname)) {
    return NextResponse.next({
      request: { headers: sanitizedHeaders },
    });
  }

  const isApi = pathname.startsWith("/api/");

  if (isApi) {
    const routePolicy = resolveApiRouteAccess(pathname, request.method);

    if (!routePolicy.knownRoute) {
      return NextResponse.json({ error: "Unknown API route", code: "ROUTE_NOT_IN_POLICY" }, { status: 404 });
    }

    if (routePolicy.access === "system") {
      const systemAuth = isValidSystemRequest(request);
      if (!systemAuth.ok) {
        if (systemAuth.reason === "missing") {
          return NextResponse.json(
            { error: "System secret is not configured", code: "SYSTEM_SECRET_MISSING" },
            { status: 503 }
          );
        }

        return NextResponse.json({ error: "Unauthorized", code: "SYSTEM_AUTH_REQUIRED" }, { status: 401 });
      }

      const headersWithVersion = withApiVersionHeader(pathname, new Headers(sanitizedHeaders));
      return NextResponse.next({ request: { headers: headersWithVersion } });
    }
  }

  let response = NextResponse.next({
    request: {
      headers: sanitizedHeaders,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isApi) {
      return NextResponse.json(
        {
          error: "Auth temporarily unavailable",
          code: "AUTH_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    return redirectToSignIn(request, "auth_unavailable");
  }

  const cookieSettings: Partial<CookieOptions> = {
    httpOnly: false,
    sameSite: "lax",
    secure: request.url.startsWith("https://") || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

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
            ...cookieSettings,
          });
        });
      },
    },
  });

  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const authHeader = request.headers.get("Authorization");
  let userFromAuthHeader: { id: string; email?: string } | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const { data: userData, error: tokenError } = await supabase.auth.getUser(token);
      if (userData?.user && !tokenError) {
        userFromAuthHeader = userData.user;
      }
    } catch (error) {
      logger.warn("[middleware] bearer token verification failed", {
        correlationId,
        path: pathname,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if ((!user || authError) && userFromAuthHeader) {
    user = userFromAuthHeader as typeof user;
    authError = null;
  }

  // If getUser() fails (or returned null), try to refresh the session.
  // This is critical on mobile browsers where the access token expires
  // while the tab is backgrounded — the refresh token in the cookie may
  // still be valid even though the access token is stale.
  if (!user) {
    try {
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshedSession?.user && !refreshError) {
        user = refreshedSession.user;
      }
    } catch (error) {
      logger.warn("[middleware] session refresh failed", {
        correlationId,
        path: pathname,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const session = user ? { user } : null;

  if (isApi) {
    const routePolicy = resolveApiRouteAccess(pathname, request.method);
    const requestHeaders = withApiVersionHeader(pathname, new Headers(sanitizedHeaders));

    if (!routePolicy.knownRoute) {
      return NextResponse.json({ error: "Unknown API route", code: "ROUTE_NOT_IN_POLICY" }, { status: 404 });
    }

    const requiresAuth =
      routePolicy.access === "authenticated" || routePolicy.access === "venue-role-scoped";

    if (!session && requiresAuth) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    if (session) {
      requestHeaders.set("x-user-id", session.user.id);
      requestHeaders.set("x-user-email", session.user.email || "");

      const searchParams = new URL(request.url).searchParams;
      const queryVenueId = searchParams.get("venueId") || searchParams.get("venue_id");
      if (queryVenueId) {
        const normalizedApiVenueId = normalizeVenueId(queryVenueId) ?? queryVenueId;
        try {
          const { data: apiCtx, error: apiRpcErr } = await supabase.rpc("get_access_context", {
            p_venue_id: normalizedApiVenueId,
          });

          if (!apiRpcErr && apiCtx) {
            const apiRpc = apiCtx as { user_id?: string; role?: string; tier?: string };
            if (apiRpc.user_id === session.user.id && apiRpc.role && apiRpc.tier) {
              requestHeaders.set("x-user-tier", apiRpc.tier.toLowerCase().trim());
              requestHeaders.set("x-user-role", apiRpc.role);
              requestHeaders.set("x-venue-id", normalizedApiVenueId);
            } else if (routePolicy.access === "venue-role-scoped") {
              return NextResponse.json({ error: "Forbidden", code: "VENUE_ACCESS_DENIED" }, { status: 403 });
            }
          } else if (routePolicy.access === "venue-role-scoped") {
            return NextResponse.json({ error: "Forbidden", code: "VENUE_ACCESS_DENIED" }, { status: 403 });
          }
        } catch (error) {
          logger.warn("[middleware] get_access_context failed for API route", {
            correlationId,
            path: pathname,
            venueId: normalizedApiVenueId,
            error: error instanceof Error ? error.message : String(error),
          });
          if (routePolicy.access === "venue-role-scoped") {
            return NextResponse.json({ error: "Forbidden", code: "VENUE_ACCESS_DENIED" }, { status: 403 });
          }
        }
      }
    }

    return forwardWithHeaders(requestHeaders, response);
  }

  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return redirectToSignIn(request);
    }

    const segments = pathname.split("/").filter(Boolean);
    const venueSegment = segments[1];

    if (!venueSegment) {
      const requestHeaders = new Headers(sanitizedHeaders);
      requestHeaders.set("x-user-id", session.user.id);
      requestHeaders.set("x-user-email", session.user.email || "");
      return forwardWithHeaders(requestHeaders, response);
    }

    const normalizedVenueId = normalizeVenueId(venueSegment) ?? venueSegment;

    const requestHeaders = new Headers(sanitizedHeaders);
    requestHeaders.set("x-user-id", session.user.id);
    requestHeaders.set("x-user-email", session.user.email || "");

    try {
      const { data, error: rpcErr } = await supabase.rpc("get_access_context", {
        p_venue_id: normalizedVenueId,
      });

      if (rpcErr || !data) {
        return redirectToSignIn(request, "forbidden");
      }

      const ctx = data as { user_id?: string; role?: string; tier?: string; venue_id?: string | null };
      const tier = ctx.tier?.toLowerCase().trim();

      if (
        ctx.user_id !== session.user.id ||
        !ctx.role ||
        !tier ||
        !["starter", "pro", "enterprise"].includes(tier)
      ) {
        return redirectToSignIn(request, "forbidden");
      }

      requestHeaders.set("x-user-tier", tier);
      requestHeaders.set("x-user-role", ctx.role);
      requestHeaders.set("x-venue-id", ctx.venue_id || normalizedVenueId);

      return forwardWithHeaders(requestHeaders, response);
    } catch (error) {
      logger.warn("[middleware] get_access_context failed for dashboard route", {
        correlationId,
        path: pathname,
        venueId: normalizedVenueId,
        error: error instanceof Error ? error.message : String(error),
      });
      return redirectToSignIn(request, "forbidden");
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_MATCHER = ["/dashboard", "/api"];

const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/sign-out",
  "/auth",
  "/order",
  "/order-tracking",
  "/order-summary",
  "/checkout",
  "/payment",
  "/demo",
  "/cookies",
  "/privacy",
  "/terms",
  "/refund-policy",
];

/**
 * Checks if a JWT token is expired or invalid
 */
function isTokenExpiredOrInvalid(token: string | undefined): boolean {
  if (!token || token === "" || token === "undefined" || token === "null") {
    return true;
  }

  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split(".");
    if (parts.length !== 3) {
      return true;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;

    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    if (exp && exp * 1000 < Date.now()) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Allow public assets and auth routes
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path.startsWith("/robots.txt") ||
    path.startsWith("/manifest.json") ||
    path.startsWith("/sw.js")
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some((route) => path.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = PROTECTED_MATCHER.some((m) => path.startsWith(m));
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // For protected routes, verify authentication
  const res = NextResponse.next();

  try {
    // Get all auth-related cookies
    const allCookies = req.cookies.getAll();
    const authCookies = allCookies.filter(
      (c) =>
        c.name.includes("sb-") &&
        (c.name.includes("access-token") || c.name.includes("refresh-token"))
    );

    // Find the access token cookie
    const accessTokenCookie = authCookies.find((c) => c.name.includes("access-token"));

    // Proactively clean up expired/invalid tokens to prevent errors
    if (accessTokenCookie && isTokenExpiredOrInvalid(accessTokenCookie.value)) {
      // Token is expired or invalid - clear all auth cookies
      authCookies.forEach((cookie) => {
        res.cookies.delete(cookie.name);
      });
      return res;
    }

    // If no auth cookies, no need to create client
    if (authCookies.length === 0) {
      return res;
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => {
            return req.cookies.get(name)?.value;
          },
          set: (name, value, options) => {
            res.cookies.set(name, value, options);
          },
          remove: (name) => {
            res.cookies.delete(name);
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Override getSession to suppress refresh token errors completely
    const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
    supabase.auth.getSession = async () => {
      try {
        return await originalGetSession();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          errorMessage.includes("refresh_token_not_found") ||
          errorMessage.includes("Invalid Refresh Token") ||
          errorMessage.includes("refresh_token")
        ) {
          // Silently return null session for refresh token errors
          return { data: { session: null }, error: null };
        }
        throw err;
      }
    };

    // Use getSession() to check auth
    await supabase.auth.getSession();

    return res;
  } catch {
    // Silently handle all auth-related errors
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)"],
};

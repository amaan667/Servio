import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
  // "/api/analytics/vitals" - PUBLIC: web performance metrics, no auth needed
  // "/api/auth" - PUBLIC: auth endpoints must be accessible
  "/api/qr",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public paths
  if (!protectedPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Log mobile Safari requests for debugging
  const userAgent = request.headers.get("user-agent") || "";
  const isMobileSafari =
    /iPhone|iPad|iPod/.test(userAgent) &&
    /Safari/.test(userAgent) &&
    !/Chrome|CriOS/.test(userAgent);

  if (isMobileSafari) {
    console.log("[MIDDLEWARE MOBILE] Request to:", pathname);
    console.log(
      "[MIDDLEWARE MOBILE] Cookies in request:",
      request.cookies
        .getAll()
        .map((c) => c.name)
        .join(", ")
    );
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string) {
        const value = request.cookies.get(name)?.value;
        if (isMobileSafari && name.includes("auth-token")) {
          console.log(`[MIDDLEWARE MOBILE] Cookie get(${name}):`, value ? "found" : "NOT FOUND");
        }
        return value;
      },
      set(name: string, value: string, options: any) {
        if (isMobileSafari && name.includes("auth-token")) {
          console.log(`[MIDDLEWARE MOBILE] Cookie set(${name}):`, value.substring(0, 30) + "...");
        }
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        if (isMobileSafari) {
          console.log(`[MIDDLEWARE MOBILE] Cookie remove(${name})`);
        }
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

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (isMobileSafari) {
    console.log("[MIDDLEWARE MOBILE] Session check result:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
    });
  }

  // For API routes, return 401 if no session
  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Inject user into headers for API routes to access
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.user.id);
    requestHeaders.set("x-user-email", session.user.email || "");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For dashboard pages, redirect if no session
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      if (isMobileSafari) {
        console.log("[MIDDLEWARE MOBILE] ❌ No session found - redirecting to sign-in");
      }
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    if (isMobileSafari) {
      console.log("[MIDDLEWARE MOBILE] ✅ Session validated - allowing access");
    }
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
    // "/api/analytics/:path*" - REMOVED: vitals endpoint needs to be public
    // "/api/auth/:path*" - PUBLIC: auth endpoints (sign-in, etc) must be accessible
    "/api/qr/:path*",
  ],
};

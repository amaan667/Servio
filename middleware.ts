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
  "/api/analytics",
  "/api/qr",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public paths
  if (!protectedPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
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
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
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
    "/api/analytics/:path*",
    "/api/qr/:path*",
  ],
};

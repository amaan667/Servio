import { NextResponse, type NextRequest } from "next/server";

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
  "/clear-session",
];

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Allow public assets and auth routes
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path.startsWith("/robots.txt") ||
    path.startsWith("/manifest.json") ||
    path.startsWith("/sw.js") ||
    path.startsWith("/images") ||
    path.startsWith("/assets")
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some((route) => path.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For all other routes, just let them through
  // Supabase's autoRefreshToken will handle token refresh
  // Individual pages will check auth and redirect if needed
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)"],
};

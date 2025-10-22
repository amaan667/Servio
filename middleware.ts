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

  // Skip ALL static assets and let Next.js + headers() handle them
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.startsWith("/robots") ||
    path.startsWith("/manifest") ||
    path.startsWith("/sw.js") ||
    path.startsWith("/images/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/public/")
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + "/"));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For all other routes, just let them through
  // Individual pages will check auth and redirect if needed
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)"],
};

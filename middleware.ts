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

  // Log ALL navigation attempts for debugging
  console.info("🔍 [MIDDLEWARE] Navigation request:", {
    path: path,
    method: req.method,
    url: req.url,
    userAgent: req.headers.get("user-agent"),
    referer: req.headers.get("referer"),
    timestamp: new Date().toISOString(),
  });

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
    console.info("⏭️  [MIDDLEWARE] Skipping static asset:", path);
    return NextResponse.next();
  }

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => path === route || path.startsWith(route + "/")
  );
  if (isPublicRoute) {
    console.info("✅ [MIDDLEWARE] Public route allowed:", path);
    return NextResponse.next();
  }

  // Log feature page access
  if (path.includes("/dashboard/")) {
    const pathParts = path.split("/");
    const venueId = pathParts[2];
    const feature = pathParts[3];
    console.info("🎯 [MIDDLEWARE] Dashboard feature access:", {
      venueId,
      feature,
      fullPath: path,
      timestamp: new Date().toISOString(),
    });
  }

  // For all other routes, just let them through
  // Individual pages will check auth and redirect if needed
  console.info("➡️  [MIDDLEWARE] Allowing route through:", path);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|manifest.json|sw.js).*)"],
};

import { NextResponse, type NextRequest } from "next/server";

const isAsset = (p: string) =>
  p.startsWith("/_next/") ||
  p.startsWith("/favicon") ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

// Public paths that should always be allowed
const PUBLIC_PATHS = ['/', '/auth/callback', '/pricing', '/features', '/_next', '/favicon', '/images', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes: skip auth entirely
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow assets
  if (isAsset(pathname)) {
    return NextResponse.next();
  }

  // If there is no Supabase cookie at all, don't try to read/refresh user
  const hasSbCookie = [...req.cookies.keys()].some((k) => k.includes('-auth-token'));
  if (!hasSbCookie) {
    return NextResponse.next();
  }

  // If you REALLY need auth in middleware, use auth-helpers' middleware client.
  // Otherwise, stop here. Doing SSR checks in route handlers/components is safer.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
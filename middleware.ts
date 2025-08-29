import { NextResponse, type NextRequest } from "next/server";

const isAsset = (p: string) =>
  p.startsWith("/_next/") ||
  p.startsWith("/favicon") ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

// We no longer gate routes in middleware because we rely on per-page guards.
// Supabase auth is stored in localStorage on the client, which middleware can't access.
const AUTH_COOKIE_RE = /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i;
const PROTECTED: string[] = [];

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;

  if (
    isAsset(p) ||
    p.startsWith("/api/auth/callback") ||
    p.startsWith("/auth/callback") ||
    url.searchParams.has("code") ||
    url.searchParams.has("error")
  ) {
    return NextResponse.next();
  }

  const needsAuth = PROTECTED.some((pref) => p === pref || p.startsWith(pref + "/"));
  if (!needsAuth) return NextResponse.next();

  const hasAuth = req.cookies.getAll().some((c) => AUTH_COOKIE_RE.test(c.name));
  if (!hasAuth) return NextResponse.next();
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};
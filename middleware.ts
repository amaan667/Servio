import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard"];
const isAsset = (p:string)=>p.startsWith("/_next/")||p.startsWith("/favicon")||/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);
const needsAuth = (p:string)=>PROTECTED.some(pref=>p===pref||p.startsWith(pref+"/"));
const AUTH_COOKIE_RE = /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i;

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;

  console.log('[MIDDLEWARE DEBUG] Processing request:', {
    pathname: p,
    hasCode: url.searchParams.has("code"),
    hasError: url.searchParams.has("error"),
    cookies: req.cookies.getAll().map(c => c.name)
  });

  if (
    isAsset(p) ||
    p.startsWith("/auth/callback") ||
    p.startsWith("/api/auth/callback") ||
    url.searchParams.has("code") ||
    url.searchParams.has("error")
  ) {
    console.log('[MIDDLEWARE DEBUG] Allowing request through (auth callback or asset)');
    return NextResponse.next();
  }

  if (!needsAuth(p)) {
    console.log('[MIDDLEWARE DEBUG] Path does not need auth, allowing through');
    return NextResponse.next();
  }

  const hasAuthCookie = req.cookies.getAll().some(c => AUTH_COOKIE_RE.test(c.name));
  console.log('[MIDDLEWARE DEBUG] Auth check:', {
    needsAuth: true,
    hasAuthCookie,
    authCookies: req.cookies.getAll().filter(c => AUTH_COOKIE_RE.test(c.name)).map(c => c.name)
  });
  
  if (!hasAuthCookie) {
    console.log('[MIDDLEWARE DEBUG] No auth cookie found, redirecting to sign-in');
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", p);
    return NextResponse.redirect(to);
  }
  
  console.log('[MIDDLEWARE DEBUG] Auth cookie found, allowing through');
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};



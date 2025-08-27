import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard"];
const isAsset = (p:string)=>p.startsWith("/_next/")||p.startsWith("/favicon")||/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);
const needsAuth = (p:string)=>PROTECTED.some(pref=>p===pref||p.startsWith(pref+"/"));

// Matches both old and new cookie schemes, including chunked cookies (.0, .1)
const AUTH_COOKIE_RE = /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i;

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;
  const hasCode = url.searchParams.has("code");
  const hasError = url.searchParams.has("error");

  // Always pass static, callback, and any OAuth code/error roundtrip
  if (isAsset(p) || p.startsWith("/auth/callback") || p.startsWith("/api/auth/callback") || hasCode || hasError) {
    console.log('[AUTH DEBUG] Allowing auth callback:', p);
    return NextResponse.next();
  }

  if (!needsAuth(p)) return NextResponse.next();

  const cookieNames = req.cookies.getAll().map(c => c.name);
  const hasAuthCookie = cookieNames.some(n => AUTH_COOKIE_RE.test(n));

  if (!hasAuthCookie) {
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", p);
    return NextResponse.redirect(to);
  }

  // Auth cookie present -> let client bootstrap finish
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};



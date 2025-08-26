import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard"];
const isAsset = (p: string) => p.startsWith("/_next/") || p.startsWith("/favicon") || /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);
const needsAuth = (p: string) => PROTECTED.some(pref => p === pref || p.startsWith(pref + "/"));

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;
  
  if (isAsset(p) || p.startsWith("/auth/callback") || url.searchParams.has("code")) return NextResponse.next();
  if (!needsAuth(p)) return NextResponse.next();
  
  const hasRefresh = req.cookies.getAll().some(c => /(^sb-.*-refresh-token$)|(^sb-refresh-token$)/i.test(c.name));
  if (!hasRefresh) {
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", p);
    return NextResponse.redirect(to);
  }
  
  return NextResponse.next();
}

export const config = { 
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"] 
};
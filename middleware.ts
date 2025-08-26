import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];
const isAsset = (p: string) =>
  p.startsWith("/_next/") || p.startsWith("/favicon") ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

function needsAuth(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (isAsset(pathname) || pathname.startsWith("/auth/callback") || url.searchParams.has("code")) {
    return NextResponse.next();
  }

  if (!needsAuth(pathname)) return NextResponse.next();

  // Only redirect if **no** sb-* refresh token cookie is present.
  const hasRefresh = req.cookies.getAll().some(c => /(^sb-.*-refresh-token$)|(^sb-refresh-token$)/i.test(c.name));
  if (!hasRefresh) {
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  // Let the request through; the client will finish bootstrapping.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};



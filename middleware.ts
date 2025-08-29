import { NextResponse, type NextRequest } from "next/server";

const isAsset = (p: string) =>
  p.startsWith("/_next/") ||
  p.startsWith("/favicon") ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

// Public paths that should always be allowed
const publicPaths = ['/auth/callback', '/api/health', '/', '/pricing'];

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;

  // Allow assets and public paths
  if (
    isAsset(p) ||
    publicPaths.some(path => p === path || p.startsWith(path + "/")) ||
    p.startsWith("/api/auth/callback") ||
    url.searchParams.has("code") ||
    url.searchParams.has("error")
  ) {
    return NextResponse.next();
  }

  // We no longer gate routes in middleware because we rely on per-page guards.
  // Supabase auth is stored in localStorage on the client, which middleware can't access.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};
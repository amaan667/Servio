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

  // Always pass static assets, auth-related paths, and OAuth flows
  if (isAsset(p) || 
      p.startsWith("/auth/") || 
      p.startsWith("/sign-in") || 
      p.startsWith("/sign-up") || 
      p.startsWith("/complete-profile") || 
      p.startsWith("/home") || 
      p === "/" || 
      p.startsWith("/order") || 
      p.startsWith("/payment") || 
      p.startsWith("/mobile-preview") || 
      p.startsWith("/generate-qr") || 
      p.startsWith("/settings") || 
      p.startsWith("/test-oauth") || 
      p.startsWith("/api/") || 
      p.startsWith("/docs/") || 
      p.startsWith("/scripts/") || 
      p.startsWith("/data/") || 
      p.startsWith("/public/") || 
      p.startsWith("/styles/") || 
      p.startsWith("/types/") || 
      p.startsWith("/hooks/") || 
      p.startsWith("/lib/") || 
      p.startsWith("/components/") || 
      p.startsWith("/pages/") || 
      p.startsWith("/src/") || 
      p.startsWith("/favicon") || 
      p.startsWith("/robots") || 
      p.startsWith("/sitemap") || 
      p.startsWith("/manifest") || 
      p.startsWith("/_next/") || 
      p.startsWith("/trivial-change") || 
      p.startsWith("/middleware") || 
      p.startsWith("/package") || 
      p.startsWith("/node_modules") || 
      p.startsWith("/.well-known") || 
      p.startsWith("/.env") || 
      p.startsWith("/.git") || 
      p.startsWith("/.github") || 
      p.startsWith("/.vscode") || 
      p.startsWith("/.idea") || 
      p.startsWith("/.editorconfig") || 
      p.startsWith("/.eslintrc") || 
      p.startsWith("/.prettierrc") || 
      p.startsWith("/.babelrc") || 
      p.startsWith("/.browserslistrc") || 
      p.startsWith("/.gitignore") || 
      hasCode || 
      hasError) {
    console.log('[AUTH DEBUG] Allowing path:', p);
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



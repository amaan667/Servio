import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard"];
const isAsset = (p:string)=>p.startsWith("/_next/")||p.startsWith("/favicon")||/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);
const needsAuth = (p:string)=>PROTECTED.some(pref=>p===pref||p.startsWith(pref+"/"));
// Updated to match Supabase SSR cookie patterns
const AUTH_COOKIE_PATTERNS = [
  /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i,  // Original pattern
  /^sb-[a-z0-9]+-auth-token$/i,            // Without version suffix
  /^sb-[a-z0-9]+-auth$/i,                  // Shorter auth token
  /^sb-[a-z0-9]+-refresh-token$/i,         // Refresh token
  /^sb-[a-z0-9]+-access-token$/i,          // Access token
  /^sb-[a-z0-9]+-session$/i,               // Session cookie
  /^sb-[a-z0-9]+-user$/i,                  // User cookie
  /^sb-[a-z0-9]+-token$/i,                 // Generic token cookie
];

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

  const allCookies = req.cookies.getAll();
  const hasAuthCookie = allCookies.some(c => 
    AUTH_COOKIE_PATTERNS.some(pattern => pattern.test(c.name))
  );
  
  // Fallback: check for any Supabase-related cookies
  const hasSupabaseCookie = allCookies.some(c => 
    c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth')
  );
  
  const authCookies = allCookies.filter(c => 
    AUTH_COOKIE_PATTERNS.some(pattern => pattern.test(c.name))
  );
  
  const supabaseCookies = allCookies.filter(c => 
    c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth')
  );
  
  console.log('[MIDDLEWARE DEBUG] Auth check:', {
    needsAuth: true,
    hasAuthCookie,
    hasSupabaseCookie,
    authCookies: authCookies.map(c => c.name),
    supabaseCookies: supabaseCookies.map(c => c.name),
    allCookies: allCookies.map(c => c.name)
  });
  
  // Temporary debug: log all cookies to understand the pattern
  console.log('[MIDDLEWARE DEBUG] All cookies:', allCookies.map(c => ({ name: c.name, value: c.value?.substring(0, 20) + '...' })));
  
  if (!hasAuthCookie && !hasSupabaseCookie) {
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



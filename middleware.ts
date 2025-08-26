import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = new Set([
  "/", "/features", "/sign-in", "/auth/callback",
]);

const isAsset = (p: string) =>
  p.startsWith("/_next/") ||
  p.startsWith("/favicon") ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Always allow callback and OAuth code roundtrips
  if (pathname.startsWith("/auth/callback") || url.searchParams.has("code") || isAsset(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: "", ...options, maxAge: 0 }),
      },
    }
  );

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user ?? null;
    // If Supabase returns 400 (no/invalid refresh token), treat as signed-out
    if (error && (error as any).status === 400) {
      // purge any existing sb-* auth cookies
      req.cookies.getAll()
        .filter(c => c.name.startsWith("sb-"))
        .forEach(c => res.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" }));
    }
  } catch (e: any) {
    // Never crash middleware on auth errors
    if (e?.status === 400 || e?.code === "refresh_token_not_found") {
      req.cookies.getAll()
        .filter(c => c.name.startsWith("sb-"))
        .forEach(c => res.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" }));
    }
  }

  const isPublic = PUBLIC_PATHS.has(pathname);
  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected && !user) {
    const to = new URL("/sign-in", req.url);
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  return res;
}

// Exclude static assets from middleware
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};



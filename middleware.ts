import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = new Set<string>([
	"/", "/features", "/sign-in", "/auth/callback",
]);

const PROTECTED_PREFIXES = ["/dashboard"]; // add more if needed

const isAsset = (p: string) =>
	p.startsWith("/_next/") ||
	p.startsWith("/favicon") ||
	/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/.test(p);

function needsAuth(pathname: string) {
	return PROTECTED_PREFIXES.some((pref) => pathname === pref || pathname.startsWith(pref + "/"));
}

export async function middleware(req: NextRequest) {
	const url = new URL(req.url);
	const pathname = url.pathname;

	// Always allow static, callback, and any request carrying OAuth code
	if (isAsset(pathname) || pathname.startsWith("/auth/callback") || url.searchParams.has("code")) {
		return NextResponse.next();
	}

	// If route isn't protected, skip auth entirely
	if (!needsAuth(pathname) || PUBLIC_PATHS.has(pathname)) {
		return NextResponse.next();
	}

	// BEFORE hitting Supabase, check if a refresh token cookie even exists
	const cookieNames = req.cookies.getAll().map((c) => c.name);
	const hasRefresh = cookieNames.some((n) =>
		/(^sb-.*-refresh-token$)|(^sb-refresh-token$)/i.test(n)
	);
	if (!hasRefresh) {
		// No refresh token -> treat as signed-out, no Supabase call, no error
		const to = new URL("/sign-in", req.url);
		to.searchParams.set("next", pathname);
		return NextResponse.redirect(to);
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

	try {
		const { data, error } = await supabase.auth.getUser();
		if (error && (error as any).status === 400) {
			// Bad/expired tokens: purge sb-* cookies silently and redirect to sign-in
			req.cookies.getAll()
				.filter((c) => c.name.startsWith("sb-"))
				.forEach((c) => res.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" }));
			return NextResponse.redirect(new URL("/sign-in", req.url));
		}
		if (!data?.user) {
			return NextResponse.redirect(new URL("/sign-in", req.url));
		}
		return res;
	} catch {
		// Never crash middleware; purge cookies and redirect
		req.cookies.getAll()
			.filter((c) => c.name.startsWith("sb-"))
			.forEach((c) => res.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" }));
		return NextResponse.redirect(new URL("/sign-in", req.url));
	}
}

// Exclude static assets from middleware
export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)",
	],
};



import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams, origin, host, pathname } = new URL(request.url);
  const code = searchParams.get("code");
  console.log("[AUTH DEBUG] /auth/callback/handle GET", {
    origin,
    host,
    pathname,
    hasCode: Boolean(code),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!code) {
    console.log("[AUTH DEBUG] /auth/callback/handle: missing code -> redirect /sign-in?error=no_code");
    return NextResponse.redirect(new URL("/sign-in?error=no_code", request.url));
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: "", ...options }),
      },
    }
  );

  // Exchange code for a session
  console.log("[AUTH DEBUG] exchangeCodeForSession starting");
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    console.error("[AUTH DEBUG] exchangeCodeForSession failed", {
      name: exchangeErr.name,
      message: exchangeErr.message,
      status: (exchangeErr as any)?.status,
    });
    return NextResponse.redirect(new URL("/sign-in?error=exchange_failed", request.url));
  }
  console.log("[AUTH DEBUG] exchangeCodeForSession success");

  // Get the user
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    console.log("[AUTH DEBUG] getUser returned no user", { userErr });
    return NextResponse.redirect(new URL("/sign-in?error=no_user", request.url));
  }
  console.log("[AUTH DEBUG] getUser success", { userId: user.id });

  // Check if venue exists
  console.log("[AUTH DEBUG] querying venues for owner", { ownerId: user.id });
  const { data: venues, error: venuesErr } = await supabase
    .from("venues")
    .select("venue_id")
    .eq("owner_id", user.id)
    .limit(1);

  if (venuesErr) {
    console.log("[AUTH DEBUG] venues query error", { venuesErr });
  }

  if (!venues || venues.length === 0) {
    console.log("[AUTH DEBUG] no venues found -> redirect /complete-profile");
    return NextResponse.redirect(new URL("/complete-profile", request.url));
  }

  const dest = `/dashboard/${venues[0].venue_id}`;
  console.log("[AUTH DEBUG] venues found -> redirect to", { dest });
  // Redirect to dashboard
  return NextResponse.redirect(new URL(dest, request.url));
}

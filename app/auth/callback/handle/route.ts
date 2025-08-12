import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
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
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    console.error("[AUTH] exchange failed:", exchangeErr);
    return NextResponse.redirect(new URL("/sign-in?error=exchange_failed", request.url));
  }

  // Get the user
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.redirect(new URL("/sign-in?error=no_user", request.url));
  }

  // Check if venue exists
  const { data: venues } = await supabase
    .from("venues")
    .select("venue_id")
    .eq("owner_id", user.id)
    .limit(1);

  if (!venues || venues.length === 0) {
    return NextResponse.redirect(new URL("/complete-profile", request.url));
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL(`/dashboard/${venues[0].venue_id}`, request.url));
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    logger.info("[AUTH SIGN-IN] Email/password sign-in attempt:", { email });

    // Create server-side Supabase client that can set cookies
    const supabase = await createServerSupabase();

    // Sign in with password - THIS SETS THE COOKIES!
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      logger.error("[AUTH SIGN-IN] Sign-in error:", { error: signInError.message });
      return NextResponse.json({ error: signInError.message }, { status: 401 });
    }

    if (!data.session) {
      logger.error("[AUTH SIGN-IN] No session returned");
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    logger.info("[AUTH SIGN-IN] ✅ User signed in successfully:", {
      userId: data.session.user.id,
      email: data.session.user.email,
    });

    // Check cookies after sign-in
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies.filter((c) => c.name.includes("sb-"));

    logger.info("[AUTH SIGN-IN] Cookies after sign-in:", {
      totalCookies: allCookies.length,
      authCookiesCount: authCookies.length,
      authCookieNames: authCookies.map((c) => c.name).join(", "),
    });

    // Check if user has a venue
    const { data: venues } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("owner_user_id", data.session.user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    // Return success with redirect URL
    return NextResponse.json({
      success: true,
      user: {
        id: data.session.user.id,
        email: data.session.user.email,
      },
      redirectTo:
        venues && venues.length > 0 && venues[0]
          ? `/dashboard/${venues[0].venue_id}`
          : "/select-plan",
    });
  } catch (err) {
    logger.error("[AUTH SIGN-IN] Unexpected error:", { error: err });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

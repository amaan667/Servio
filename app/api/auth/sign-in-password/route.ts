import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }


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

    // Check if user has a venue - get FIRST (oldest)
    const { data: venues } = await supabase
      .from("venues")
      .select("venue_id, created_at")
      .eq("owner_user_id", data.session.user.id)
      .order("created_at", { ascending: true })
      .limit(5); // Get first 5 to debug

    logger.info("[AUTH SIGN-IN] 📊 EMAIL/PASSWORD - User venues:", {
      venueCount: venues?.length,
      venues: venues?.map((v) => ({ id: v.venue_id, created: v.created_at })),
      firstVenue: venues?.[0]?.venue_id,
      allVenueIds: venues?.map((v) => v.venue_id),
    });

    // Create response with cookies set manually
    const redirectTo =
      venues && venues.length > 0 && venues[0]
        ? `/dashboard/${venues[0].venue_id}`
        : "/select-plan";

    logger.info("[AUTH SIGN-IN] ✅ EMAIL/PASSWORD - Redirecting to:", {
      redirectTo,
      selectedVenue: venues?.[0]?.venue_id,
      createdAt: venues?.[0]?.created_at,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.session.user.id,
        email: data.session.user.email,
      },
      redirectTo,
      // Return session tokens so client can set them in browser storage
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
      },
    });

    // Get Supabase project ID from URL for cookie names
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";

    // DON'T manually set cookies - let Supabase SSR handle it!
    // The createServerSupabase() client already sets cookies via the signInWithPassword call

    return response;
  } catch (err) {
    logger.error("[AUTH SIGN-IN] Unexpected error:", { error: err });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

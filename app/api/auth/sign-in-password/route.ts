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
    let supabase;
    try {
      supabase = await createServerSupabase();
    } catch (dbError) {
      logger.error("[AUTH SIGN-IN] Failed to create Supabase client:", { error: dbError });
      return NextResponse.json(
        { error: "Database connection error. Please try again in a moment." },
        { status: 503 }
      );
    }

    // Sign in with password - THIS SETS THE COOKIES!
    let data, signInError;
    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      data = result.data;
      signInError = result.error;
    } catch (fetchError) {
      logger.error("[AUTH SIGN-IN] Network error during sign-in:", { error: fetchError });
      const errorMsg =
        fetchError instanceof Error ? fetchError.message : "Network connection failed";
      if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
        return NextResponse.json(
          { error: "Connection timeout. Please check your internet and try again." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Network error. Please try again." }, { status: 503 });
    }

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
    // Add timeout protection for mobile networks (especially Safari)
    let venues = null;
    let venueError = null;
    let hasOrganization = false;

    // First check organization to see if user has premium plan
    try {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, subscription_tier")
        .eq("owner_user_id", data.session.user.id)
        .limit(1);

      hasOrganization = !!(orgs && orgs.length > 0);
      if (hasOrganization) {
        logger.info("[AUTH SIGN-IN] User has organization:", {
          orgCount: orgs?.length,
          tier: orgs?.[0]?.subscription_tier,
        });
      }
    } catch (orgError) {
      logger.error("[AUTH SIGN-IN] Error checking organization:", { error: orgError });
    }

    // Now try to get venues with timeout protection
    try {
      const venueQuery = await Promise.race([
        supabase
          .from("venues")
          .select("venue_id, created_at")
          .eq("owner_user_id", data.session.user.id)
          .order("created_at", { ascending: true })
          .limit(5),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Venue query timeout")), 3000)
        ),
      ]);
      venues = (venueQuery as { data: unknown; error: unknown }).data;
      venueError = (venueQuery as { data: unknown; error: unknown }).error;
    } catch (timeoutError) {
      logger.error("[AUTH SIGN-IN] Venue query timeout or error:", { error: timeoutError });

      // If user has organization, they must have venues - use generic dashboard
      if (hasOrganization) {
        logger.info("[AUTH SIGN-IN] Timeout but org exists - using generic dashboard redirect");
        const response = NextResponse.json({
          success: true,
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
          },
          redirectTo: "/dashboard",
          hasVenues: true, // Signal to client that venues exist
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
          },
        });
        return response;
      }
    }

    logger.info("[AUTH SIGN-IN] 📊 EMAIL/PASSWORD - User venues:", {
      venueCount: Array.isArray(venues) ? venues.length : 0,
      venues: Array.isArray(venues)
        ? venues.map((v) => ({ id: v.venue_id, created: v.created_at }))
        : [],
      firstVenue: Array.isArray(venues) && venues[0] ? venues[0].venue_id : null,
      allVenueIds: Array.isArray(venues) ? venues.map((v) => v.venue_id) : [],
      hadError: !!venueError,
    });

    // Check if user has pending signup data (incomplete signup flow)
    const pendingSignup = data.session.user.user_metadata?.pending_signup;
    const hasPendingSignup = !!pendingSignup;

    logger.info("[AUTH SIGN-IN] 📊 User signup status:", {
      hasVenues: Array.isArray(venues) && venues.length > 0,
      hasPendingSignup,
      pendingSignupTier: pendingSignup?.tier,
    });

    // Create response with cookies set manually
    let redirectTo: string;
    if (Array.isArray(venues) && venues.length > 0 && venues[0]) {
      // User has venues - go to dashboard
      redirectTo = `/dashboard/${venues[0].venue_id}`;
    } else if (hasPendingSignup) {
      // User has pending signup data but no venues - redirect to onboarding
      redirectTo = "/onboarding/venue-setup";
    } else {
      // No venues and no pending signup - redirect to plan selection
      redirectTo = "/select-plan";
    }

    logger.info("[AUTH SIGN-IN] ✅ EMAIL/PASSWORD - Redirecting to:", {
      redirectTo,
      selectedVenue: Array.isArray(venues) && venues[0] ? venues[0].venue_id : null,
      createdAt: Array.isArray(venues) && venues[0] ? venues[0].created_at : null,
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

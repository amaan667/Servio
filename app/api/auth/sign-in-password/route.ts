import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return apiErrors.badRequest("Email and password are required");
    }

    // Create server-side Supabase client that can set cookies
    let supabase;
    try {
      supabase = await createServerSupabase();
    } catch (dbError) {
      
      return apiErrors.serviceUnavailable(
        "Database connection error. Please try again in a moment."
      );
    }

    // Sign in with password - THIS SETS THE COOKIES!
    let data, signInError;
    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,

      data = result.data;
      signInError = result.error;
    } catch (fetchError) {
      
      const errorMsg =
        fetchError instanceof Error ? fetchError.message : "Network connection failed";
      if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
        return apiErrors.serviceUnavailable(
          "Connection timeout. Please check your internet and try again."
        );
      }
      return apiErrors.serviceUnavailable("Network error. Please try again.");
    }

    if (signInError) {
      
      return apiErrors.unauthorized(signInError.message);
    }

    if (!data.session) {
      
      return apiErrors.internal("Failed to create session");
    }

    

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
        
      }
    } catch (orgError) {
      
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
      

      // If user has organization, they must have venues - use generic dashboard
      if (hasOrganization) {
        
        const response = NextResponse.json({

          },

          hasVenues: true, // Signal to client that venues exist

          },

        return response;
      }
    }

     ? venues.length : 0,

        ? venues.map((v) => ({ id: v.venue_id, created: v.created_at }))

    // Check if user has pending signup data (incomplete signup flow)
    const pendingSignup = data.session.user.user_metadata?.pending_signup;
    const hasPendingSignup = !!pendingSignup;

     && venues.length > 0,
      hasPendingSignup,

    // Create response with cookies set manually
    let redirectTo: string;
    if (Array.isArray(venues) && venues.length > 0 && venues[0]) {
      // User has venues - go to dashboard
      redirectTo = `/dashboard/${venues[0].venue_id}`;
    } else if (hasPendingSignup) {
      // User has pending signup data but no venues - redirect to onboarding
      redirectTo = "/onboarding/venue-setup";
    } else {
      // No venues and no pending signup - redirect to home page
      // User can then click "Start Free Trial" to go to plan selection
      redirectTo = "/";
    }

     && venues[0] ? venues[0].venue_id : null,

    const response = NextResponse.json({

      },
      redirectTo,
      // Return session tokens so client can set them in browser storage

      },

    // Supabase SSR handles cookies automatically

    // DON'T manually set cookies - let Supabase SSR handle it!
    // The createServerSupabase() client already sets cookies via the signInWithPassword call

    return response;
  } catch (err) {
    
    return apiErrors.internal("An unexpected error occurred");
  }
}

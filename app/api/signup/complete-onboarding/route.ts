// Complete onboarding and create organization/venue
// Called after user finishes or skips onboarding wizard

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { requireAuthForAPI, requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(_request: NextRequest) {
  try {
    const req = _request;

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userMetadata = session.user.user_metadata;
    const pendingSignup = userMetadata?.pending_signup;

    if (!pendingSignup) {
      // Check if user already has organization/venue (already completed onboarding)
      const adminSupabase = await createClient();
      const { data: existingVenues } = await adminSupabase
        .from("venues")
        .select("venue_id, organization_id")
        .eq("owner_user_id", userId)
        .limit(1);

      if (existingVenues && existingVenues.length > 0) {
        return NextResponse.json({
          success: true,
          venueId: existingVenues[0].venue_id,
          organizationId: existingVenues[0].organization_id,
          message: "Onboarding already completed",
        });
      }

      return NextResponse.json(
        { error: "No pending signup data found. Please start over." },
        { status: 400 }
      );
    }

    const { venueName, venueType, serviceType, tier, stripeCustomerId } = pendingSignup;

    if (!venueName || !tier) {
      return NextResponse.json({ error: "Missing required signup data" }, { status: 400 });
    }

    const adminSupabase = await createClient();

    // Create organization
    const { data: org, error: orgError } = await adminSupabase
      .from("organizations")
      .insert({
        owner_user_id: userId,
        subscription_tier: tier,
        subscription_status: "trialing",
        stripe_customer_id: stripeCustomerId || null,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (orgError || !org) {
      logger.error("[COMPLETE ONBOARDING] Failed to create organization:", {
        error: orgError,
        userId,
        tier,
      });

      return NextResponse.json(
        {
          error: "Failed to create organization",
          details: orgError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // Create venue
    const { error: venueError } = await adminSupabase
      .from("venues")
      .insert({
        venue_id: venueId,
        name: venueName,
        business_type: venueType || "Restaurant",
        service_type: serviceType || "table_service",
        owner_user_id: userId,
        organization_id: org.id,
      })
      .select()
      .single();

    if (venueError) {
      logger.error("[COMPLETE ONBOARDING] Failed to create venue:", {
        error: venueError,
        userId,
        venueId,
        venueName,
        organizationId: org.id,
      });

      // Clean up organization
      try {
        await adminSupabase.from("organizations").delete().eq("id", org.id);
      } catch (cleanupError) {
        logger.error("[COMPLETE ONBOARDING] Failed to cleanup organization:", cleanupError);
      }

      return NextResponse.json(
        {
          error: "Failed to create venue",
          details: venueError.message,
        },
        { status: 500 }
      );
    }

    // Create user-venue role
    await adminSupabase.from("user_venue_roles").insert({
      user_id: userId,
      venue_id: venueId,
      organization_id: org.id,
      role: "owner",
    });

    // Clear pending signup data from user metadata
    await adminSupabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        full_name: userMetadata.full_name,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      },
    });

    logger.info("[COMPLETE ONBOARDING] Successfully created organization and venue:", {
      userId,
      venueId,
      organizationId: org.id,
      tier,
    });

    return NextResponse.json({
      success: true,
      userId,
      venueId,
      organizationId: org.id,
      message: "Onboarding completed successfully!",
    });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[COMPLETE ONBOARDING] Error:", {
      error: errorMessage,
      stack: _error instanceof Error ? _error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to complete onboarding",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

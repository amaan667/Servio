// API endpoint to ensure a user has a real organization
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

// Disable caching to always get fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request);

    // Get the current user with better error handling
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (sessionError) {
      logger.error("[ORG ENSURE] Session error:", sessionError);
      return NextResponse.json(
        { error: "Session error", details: sessionError.message },
        { status: 401 }
      );
    }

    if (!user) {
      logger.error("[ORG ENSURE] No user found in session");
      return NextResponse.json(
        { error: "No user found", details: "User not authenticated" },
        { status: 401 }
      );
    }

    logger.debug("[ORG ENSURE] User authenticated:", user.id);

    // Use admin client to bypass RLS for organization operations
    let adminClient;
    try {
      adminClient = createAdminClient();
      logger.debug("[ORG ENSURE] Admin client created successfully");
    } catch (adminError) {
      logger.error("[ORG ENSURE] Failed to create admin client:", { error: adminError });
      return NextResponse.json(
        { error: "Admin client creation failed", details: String(adminError) },
        { status: 500 }
      );
    }

    // Verify SERVICE_ROLE_KEY is set
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error("[ORG ENSURE] SUPABASE_SERVICE_ROLE_KEY is not set!");
      return NextResponse.json(
        { error: "Server configuration error: Missing SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // Check if user already has an organization (by created_by OR owner_user_id)
    logger.debug("[ORG ENSURE] Checking for existing organization for user:", user.id);
    const { data: existingOrg, error: orgCheckError } = await adminClient
      .from("organizations")
      .select(
        "id, subscription_tier, subscription_status, is_grandfathered, trial_ends_at, created_by, owner_user_id"
      )
      .or(`created_by.eq.${user.id},owner_user_id.eq.${user.id}`)
      .maybeSingle();

    if (orgCheckError) {
      logger.error("[ORG ENSURE] Error checking existing org:", orgCheckError);
    }

    // If organization exists, return it with no-cache headers
    if (existingOrg && !orgCheckError) {
      logger.debug("[ORG ENSURE] Found existing organization:", existingOrg.id);
      const response = NextResponse.json({
        success: true,
        organization: existingOrg,
        created: false,
      });

      // Add cache control headers to ensure fresh data
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    }

    logger.debug("[ORG ENSURE] No existing organization, creating new one");

    // Get user's name for organization name
    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

    // Create organization for the user using admin client to bypass RLS
    // Use the user's actual creation date as trial start date for accurate trial calculation
    const userCreatedAt = new Date(user.created_at);
    const trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data: newOrg, error: createError } = await adminClient
      .from("organizations")
      .insert({
        name: `${userName}'s Organization`,
        slug: `org-${user.id.slice(0, 8)}-${Date.now()}`,
        created_by: user.id,
        owner_user_id: user.id, // Set owner_user_id for proper organization ownership
        subscription_tier: "basic",
        subscription_status: "trialing",
        is_grandfathered: false,
        trial_ends_at: trialEndsAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, subscription_tier, subscription_status, is_grandfathered, trial_ends_at")
      .single();

    if (createError) {
      logger.error("[ORG ENSURE] Error creating organization:", createError);
      logger.error("[ORG ENSURE] Error details:", { error: JSON.stringify(createError, null, 2) });
      logger.error("[ORG ENSURE] User ID:", user.id);
      logger.error("[ORG ENSURE] User metadata:", user.user_metadata);
      return NextResponse.json(
        {
          error: "Failed to create organization",
          details: createError.message,
          code: createError.code,
          hint: createError.hint,
        },
        { status: 500 }
      );
    }

    // Update unknown venues to link to this organization (using admin client)
    await adminClient
      .from("venues")
      .update({ organization_id: newOrg.id })
      .eq("owner_user_id", user.id)
      .is("organization_id", null);

    // Create user_venue_roles entries (using admin client)
    const { data: userVenues } = await adminClient
      .from("venues")
      .select("venue_id")
      .eq("owner_user_id", user.id);

    if (userVenues && userVenues.length > 0) {
      const venueRoles = userVenues.map((venue) => ({
        user_id: user.id,
        venue_id: venue.venue_id,
        organization_id: newOrg.id,
        role: "owner",
        permissions: { all: true },
      }));

      await adminClient.from("user_venue_roles").upsert(venueRoles, {
        onConflict: "user_id,venue_id",
      });
    }

    logger.debug("[ORG ENSURE] Created new organization", {
      data: { orgId: newOrg.id, userId: user.id },
    });

    const response = NextResponse.json({
      success: true,
      organization: newOrg,
      created: true,
    });

    // Add cache control headers to ensure fresh data
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    logger.error("[ORG ENSURE] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

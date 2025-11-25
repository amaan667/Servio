// API endpoint to ensure a user has a real organization
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireAuthForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Disable caching to always get fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Authentication check
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const supabase = await createServerSupabase();

    // Get the current user with better error handling
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const user = session?.user;

    logger.info("[ORG ENSURE] Session check:", {
      hasSession: !!session,
      hasUser: !!user,
      userId: user?.id,
      sessionError: sessionError?.message,
      sessionErrorDetails: sessionError,
    });

    if (sessionError) {
      logger.error("[ORG ENSURE] Session error:", {
        error: sessionError,
        message: sessionError.message,
        status: sessionError.status,
      });
      return NextResponse.json(
        { error: "Session error", details: sessionError.message },
        { status: 401 }
      );
    }

    if (!user) {
      logger.error("[ORG ENSURE] No user found in session - user needs to sign in");
      return NextResponse.json(
        { error: "No user found", details: "User not authenticated. Please sign in again." },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS for organization operations
    let adminClient;
    try {
      const { createAdminClient } = await import("@/lib/supabase");
      adminClient = createAdminClient();
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

    // Check if user already has an organization (by created_by or owner_user_id)

    // First try owner_user_id (if column exists)
    let { data: existingOrg, error: orgCheckError } = await adminClient
      .from("organizations")
      .select(
        "id, subscription_tier, subscription_status, trial_ends_at, created_by, owner_user_id"
      )
      .eq("owner_user_id", user.id)
      .maybeSingle();

    // If not found, try created_by (actual database column)
    if (!existingOrg && !orgCheckError) {
      const result = await adminClient
        .from("organizations")
        .select(
          "id, subscription_tier, subscription_status, trial_ends_at, created_by, owner_user_id"
        )
        .eq("created_by", user.id)
        .maybeSingle();

      existingOrg = result.data;
      orgCheckError = result.error;
    }

    if (orgCheckError) {
      logger.error("[ORG ENSURE] Error checking existing org:", orgCheckError);
    }

    // If organization exists, return it with no-cache headers
    if (existingOrg && !orgCheckError) {
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

    // Create organization for the user using admin client to bypass RLS
    // Use the user's actual creation date as trial start date for accurate trial calculation
    const userCreatedAt = new Date(user.created_at);
    const trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

    const { data: newOrg, error: createError } = await adminClient
      .from("organizations")
      .insert({
        name: `${user.email?.split("@")[0] || "User"}'s Organization`,
        slug: `org-${user.id.slice(0, 8)}-${Date.now()}`,
        created_by: user.id, // Required column
        owner_user_id: user.id, // Also set for compatibility
        subscription_tier: "starter",
        subscription_status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, subscription_tier, subscription_status, trial_ends_at, created_by, owner_user_id"
      )
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

    // Link all user's venues to this organization
    const { error: venueLinkError } = await adminClient
      .from("venues")
      .update({ organization_id: newOrg.id })
      .eq("owner_user_id", user.id)
      .or(`organization_id.is.null,organization_id.neq.${newOrg.id}`);

    if (venueLinkError) {
      logger.warn("[ORG ENSURE] Could not link venues to organization:", venueLinkError);
    }

    // Create user_venue_roles entries (using admin client)
    const { data: userVenues } = await adminClient
      .from("venues")
      .select("venue_id")
      .eq("owner_user_id", user.id);

    if (userVenues && userVenues.length > 0) {
      const venueRoles = userVenues.map((venue: { venue_id: string }) => ({
        user_id: user.id,
        venue_id: venue.venue_id,
        role: "owner",
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
  } catch (_error) {
    logger.error("[ORG ENSURE] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}

// API endpoint to ensure a user has a real organization
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment } from "@/lib/env";

// Disable caching to always get fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createServerSupabase();

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
      if (!env("SUPABASE_SERVICE_ROLE_KEY")) {
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
      const userCreatedAt = new Date(user.created_at as string);
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
        logger.error("[ORG ENSURE] Error creating organization:", {
          error: createError,
          userId: user.id,
        });
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
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[ORG ENSURE] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        userId: context.user.id,
      });

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);

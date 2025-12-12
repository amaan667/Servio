// Complete onboarding and create organization/venue
// Called after user finishes or skips onboarding wizard
// Note: This route allows authenticated users (may be called during onboarding)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

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
      const userId = user.id;

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
      const pendingSignup = userMetadata?.pending_signup as
        | {
            venueName?: string;
            venueType?: string;
            serviceType?: string;
            tier?: string;
            stripeCustomerId?: string;
          }
        | undefined;

      if (!pendingSignup) {
        // Check if user already has organization/venue (already completed onboarding)
        const supabase = await createClient();
        const { data: existingVenues } = await supabase
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
        return apiErrors.badRequest("Missing required signup data");
      }

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Generate venue ID
      const venueId = `venue-${userId.slice(0, 8)}-${Date.now()}`;

      // Create organization
      const { data: org, error: orgError } = await supabase
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
            message: isDevelopment() ? orgError?.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      // Create venue
      const { error: venueError } = await supabase
        .from("venues")
        .insert({
          venue_id: venueId,
          venue_name: venueName,
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
          await supabase.from("organizations").delete().eq("id", org.id);
        } catch (cleanupError) {
          logger.error("[COMPLETE ONBOARDING] Failed to cleanup organization:", cleanupError);
        }

        return NextResponse.json(
          {
            error: "Failed to create venue",
            details: venueError.message,
            message: isDevelopment() ? venueError.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      // Create user-venue role
      await supabase.from("user_venue_roles").insert({
        user_id: userId,
        venue_id: venueId,
        role: "owner",
      });

      // Clear pending signup data from user metadata
      const { createAdminClient } = await import("@/lib/supabase");
      const adminSupabase = createAdminClient();
      await adminSupabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: (userMetadata?.full_name as string) || undefined,
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

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        userId,
        venueId,
        organizationId: org.id,
        message: "Onboarding completed successfully!",
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      logger.error("[COMPLETE ONBOARDING] Unexpected error:", {
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
          error: "Failed to complete onboarding",
          details: errorMessage,
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required (onboarding happens before venue exists)
    extractVenueId: async () => null,
  }
);

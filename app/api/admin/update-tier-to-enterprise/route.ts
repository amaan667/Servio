// Admin endpoint to update old tier names to new ones
// Updates "premium" → "enterprise", "standard" → "pro", "basic" → "starter"
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify admin role
      if (context.role !== "admin" && context.role !== "owner") {
        return NextResponse.json(
          { ok: false, error: "Admin access required" },
          { status: 403 }
        );
      }

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Update all organizations with old tier names
      const { data: premiumOrgs, error: premiumError } = await supabase
        .from("organizations")
        .update({ subscription_tier: "enterprise" })
        .eq("subscription_tier", "premium")
        .select("id");

      if (premiumError) {
        logger.error("[UPDATE TIER] Error updating premium tiers:", {
          error: premiumError,
          userId: context.user.id,
        });
      } else {
        logger.info(`[UPDATE TIER] Updated ${premiumOrgs?.length || 0} premium tiers to enterprise`);
      }

      const { data: standardOrgs, error: standardError } = await supabase
        .from("organizations")
        .update({ subscription_tier: "pro" })
        .eq("subscription_tier", "standard")
        .select("id");

      if (standardError) {
        logger.error("[UPDATE TIER] Error updating standard tiers:", {
          error: standardError,
          userId: context.user.id,
        });
      } else {
        logger.info(`[UPDATE TIER] Updated ${standardOrgs?.length || 0} standard tiers to pro`);
      }

      const { data: basicOrgs, error: basicError } = await supabase
        .from("organizations")
        .update({ subscription_tier: "starter" })
        .eq("subscription_tier", "basic")
        .select("id");

      if (basicError) {
        logger.error("[UPDATE TIER] Error updating basic tiers:", {
          error: basicError,
          userId: context.user.id,
        });
      } else {
        logger.info(`[UPDATE TIER] Updated ${basicOrgs?.length || 0} basic tiers to starter`);
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        updated: {
          premium: premiumOrgs?.length || 0,
          standard: standardOrgs?.length || 0,
          basic: basicOrgs?.length || 0,
        },
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[UPDATE TIER] Unexpected error:", {
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

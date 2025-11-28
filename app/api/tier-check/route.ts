// Tier Check API - Check if user can perform an action
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkLimit, checkFeatureAccess, getTierLimits } from "@/lib/tier-restrictions";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

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

      // STEP 2: Get venueId from context (already verified, may be null)
      const venueId = context.venueId;
      const user = context.user;

      // STEP 3: Parse request
      const body = await req.json();
      const { action, resource, currentCount } = body;
      const finalVenueId = venueId || body.venueId;

      // STEP 4: Validate inputs
      if (!finalVenueId) {
        return apiErrors.badRequest('venueId is required');
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
      // Verify venue belongs to user
      const supabase = await createClient();

      // Get venue to verify access
      const { data: venue } = await supabase
        .from("venues")
        .select("venue_id, owner_user_id")
        .eq("venue_id", finalVenueId)
        .single();

      if (!venue) {
        return apiErrors.notFound('Venue not found');
      }

      // STEP 6: Business logic
      // Check based on action type
      if (action === "create" && resource) {
        const limitCheck = await checkLimit(user.id, resource, currentCount);

        if (!limitCheck.allowed) {
          return NextResponse.json({
            allowed: false,
            tier: limitCheck.currentTier,
            limit: limitCheck.limit,
            current: currentCount,
            reason: `Limit reached: ${currentCount}/${limitCheck.limit} ${resource.replace("max", "").toLowerCase()}`,
            upgradeRequired: true,
          });
        }

        return NextResponse.json({
          allowed: true,
          tier: limitCheck.currentTier,
          limit: limitCheck.limit,
          current: currentCount,
        });
      }

      // Check feature access
      if (action === "access" && resource) {
        const featureCheck = await checkFeatureAccess(user.id, resource);

        if (!featureCheck.allowed) {
          return NextResponse.json({
            allowed: false,
            tier: featureCheck.currentTier,
            requiredTier: featureCheck.requiredTier,
            reason: `This feature requires ${featureCheck.requiredTier} tier`,
            upgradeRequired: true,
          });
        }

        return NextResponse.json({
          allowed: true,
          tier: featureCheck.currentTier,
        });
      }

      // Get all limits and current tier
      const limits = await getTierLimits(user.id);

      // Get user's organization to return tier info
      const { data: org } = await supabase
        .from("organizations")
        .select("subscription_tier")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      // STEP 7: Return success response
      return NextResponse.json({
        allowed: true,
        limits,
        tier: org?.subscription_tier || "starter",
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[TIER CHECK] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
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
          error: "Tier check failed",
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venueId || body?.venue_id;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);

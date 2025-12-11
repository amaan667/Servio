import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Get staff list for a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only access staff for venues they have access to.
 */
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate venueId
      if (!context.venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      // Use authenticated client that respects RLS (not admin client)
      // RLS policies ensure users can only access staff for venues they have access to
      const supabase = await createClient();

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-")
        ? context.venueId
        : `venue-${context.venueId}`;

      const { data: staff, error } = await supabase
        .from("staff")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .is("deleted_at", null) // Exclude soft-deleted staff members
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[STAFF LIST] Error fetching staff:", {
          error: error.message,
          venueId: context.venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch staff",
          isDevelopment() ? error.message : undefined
        );
      }

      logger.info("[STAFF LIST] Staff fetched successfully", {
        venueId: context.venueId,
        count: staff?.length || 0,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ staff: staff || [] });
    } catch (error) {
      logger.error("[STAFF LIST] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venueId") || searchParams.get("venue_id");
      } catch {
        return null;
      }
    },
  }
);

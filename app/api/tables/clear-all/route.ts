import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NUCLEAR OPTION: Clear ALL table sessions for a venue
 * Call: POST /api/tables/clear-all
 * Body: { "venueId": "venue-1e02af4d" }
 */
export const POST = withUnifiedAuth(
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
      const adminSupabase = createAdminClient();

      // Clear all table sessions
      const { error: clearSessionsError } = await adminSupabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", context.venueId);

      if (clearSessionsError) {
        logger.error("[TABLES CLEAR ALL] Error clearing sessions:", {
          error: clearSessionsError.message,
          venueId: context.venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to clear table sessions",
          isDevelopment() ? clearSessionsError.message : undefined
        );
      }

      // Clear all group sessions
      const { error: clearGroupSessionsError } = await adminSupabase
        .from("table_group_sessions")
        .delete()
        .eq("venue_id", context.venueId);

      if (clearGroupSessionsError) {
        logger.error("[TABLES CLEAR ALL] Error clearing group sessions:", {
          error: clearGroupSessionsError.message,
          venueId: context.venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to clear group sessions",
          isDevelopment() ? clearGroupSessionsError.message : undefined
        );
      }

      logger.info("[TABLES CLEAR ALL] Successfully cleared all sessions", {
        venueId: context.venueId,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({
        message: "All table sessions and group sessions cleared successfully",
      });
    } catch (error) {
      logger.error("[TABLES CLEAR ALL] Unexpected error:", {
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
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (
          (body as { venueId?: string; venue_id?: string })?.venueId ||
          (body as { venueId?: string; venue_id?: string })?.venue_id ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);

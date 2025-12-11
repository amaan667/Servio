import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";

// GET /api/reservations/unassigned?venueId=xxx - Get unassigned reservations
export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Business logic - Fetch unassigned reservations
    const supabase = await createClient();

    const { data: reservations, error: fetchError } = await supabase
      .from("unassigned_reservations")
      .select("*")
      .eq("venue_id", venueId)
      .order("start_at", { ascending: true });

    if (fetchError) {
      logger.error("[RESERVATIONS UNASSIGNED] Error fetching unassigned reservations:", {
        error: fetchError.message,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.database(
        "Failed to fetch unassigned reservations",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    logger.info("[RESERVATIONS UNASSIGNED] Unassigned reservations fetched successfully", {
      venueId,
      reservationCount: reservations?.length || 0,
      userId: context.user.id,
    });

    // STEP 4: Return success response
    return success({ reservations: reservations || [] });
  } catch (error) {
    logger.error("[RESERVATIONS UNASSIGNED] Unexpected error:", {
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
});

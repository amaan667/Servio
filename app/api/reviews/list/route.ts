import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";

// GET /api/reviews/list?venueId=xxx - Get reviews for a venue
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

    // STEP 3: Business logic - Fetch reviews
    const supabase = await createClient();

    const { data, error: fetchError } = await supabase
      .from("reviews")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return apiErrors.database(
        "Failed to fetch reviews",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    // STEP 4: Return success response
    return success({ reviews: data || [] });
  } catch (error) {
    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

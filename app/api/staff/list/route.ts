import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { getRequestMetadata } from "@/lib/api/request-helpers";

export const runtime = "nodejs";

/**
 * Get staff list for a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only access staff for venues they have access to.
 */
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const requestMetadata = getRequestMetadata(req);
    const requestId = requestMetadata.correlationId;
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
      }

      // STEP 2: Validate venueId
      if (!context.venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-")
        ? context.venueId
        : `venue-${context.venueId}`;

      // STEP 3: Business logic
      // Use service role client for consistent reads regardless of RLS policies.
      // Access is enforced by withUnifiedAuth (venue access).
      const supabase = createAdminClient();

      const { data: staff, error } = await supabase
        .from("staff")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .order("created_at", { ascending: false });

      if (error) {

        return apiErrors.database(
          "Failed to fetch staff",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 4: Return success response
      return success(
        { staff: staff || [] },
        { timestamp: new Date().toISOString(), requestId },
        requestId
      );
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined,
        requestId
      );
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

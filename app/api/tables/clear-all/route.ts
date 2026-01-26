import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NUCLEAR OPTION: Clear ALL table sessions for a venue
 * Call: POST /api/tables/clear-all
 * Body: { "venueId": "venue-1e02af4d" }
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Validate venueId
    if (!context.venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    // Business logic
    const adminSupabase = createAdminClient();

      // Clear all table sessions
      const { error: clearSessionsError } = await adminSupabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", context.venueId);

    if (clearSessionsError) {
      return apiErrors.database("Failed to clear table sessions");
    }

    // Clear all group sessions
    const { error: clearGroupSessionsError } = await adminSupabase
      .from("table_group_sessions")
      .delete()
      .eq("venue_id", context.venueId);

    if (clearGroupSessionsError) {
      return apiErrors.database("Failed to clear group sessions");
    }

    return success({
      message: "All table sessions and group sessions cleared successfully",
    });
  },
  {
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json().catch(() => ({}));
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

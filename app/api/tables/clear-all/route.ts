import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
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
        
        return apiErrors.database(
          "Failed to clear group sessions",
          isDevelopment() ? clearGroupSessionsError.message : undefined
        );
      }

      

      // STEP 4: Return success response
      return success({

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body

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

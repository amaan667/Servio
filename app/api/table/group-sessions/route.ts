import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate venueId
      const venueId = context.venueId;
      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      const supabase = createAdminClient();

      try {
        // Get all active group sessions for this venue
        const { data: groupSessions, error } = await supabase
          .from("table_group_sessions")
          .select("*")
          .eq("venue_id", venueId)
          .eq("is_active", true)
          .order("table_number", { ascending: true });

        if (error) {
          if (error.message.includes("does not exist")) {
            
            return success({

          }
          
          return apiErrors.database(
            "Failed to fetch group sessions",
            isDevelopment() ? error.message : undefined
          );
        }

        

        // STEP 4: Return success response
        return success({

      } catch (tableError) {

          venueId,

        return success({

      }
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from query

        const { searchParams } = new URL(req.url);
        return searchParams.get("venueId") || searchParams.get("venue_id");
      } catch {
        return null;
      }
    },
  }
);

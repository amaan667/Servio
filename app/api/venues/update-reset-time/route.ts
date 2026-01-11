import { NextRequest } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const updateResetTimeSchema = z.object({

  resetTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(updateResetTimeSchema, await req.json());
      const venueId = context.venueId || body.venueId || body.venue_id;

      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      const supabase = await createClient();

      // Update venue reset time
      const { error: updateError } = await supabase
        .from("venues")
        .update({

        .eq("venue_id", venueId);

      if (updateError) {
        
        return apiErrors.database(
          "Failed to update reset time",
          isDevelopment() ? updateError.message : undefined
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

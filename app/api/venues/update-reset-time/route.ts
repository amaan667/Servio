import { NextRequest } from "next/server";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const updateResetTimeSchema = z.object({
  venueId: z.string().uuid("Invalid venue ID").optional(),
  venue_id: z.string().uuid("Invalid venue ID").optional(),
  resetTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;
    const venueId = context.venueId || body.venueId || body.venue_id;

    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    // Business logic
    const supabase = await createClient();

    // Update venue reset time
    const { error: updateError } = await supabase
      .from("venues")
      .update({
        daily_reset_time: body.resetTime,
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId);

    if (updateError) {
      return apiErrors.database("Failed to update reset time");
    }

    return success({
      message: "Reset time updated successfully",
      resetTime: body.resetTime,
    });
  },
  {
    schema: updateResetTimeSchema,
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

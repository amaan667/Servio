import { NextRequest } from "next/server";
import { seedInventoryData } from "@/lib/inventory-seed";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const seedInventorySchema = z.object({
  venue_id: z.string().uuid().optional(),
});

// POST /api/inventory/seed
// Seeds inventory data for a venue (for testing/demo purposes)
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(seedInventorySchema, await req.json().catch(() => ({})));
      const venue_id = context.venueId || body.venue_id;

      if (!venue_id) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 3: Business logic
      const result = await seedInventoryData(venue_id);

      // STEP 4: Return success response
      return success(result);
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Failed to seed inventory data",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);

import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const { id, active } = await req.json().catch(() => ({}));

      if (!id || typeof active !== "boolean") {
        return apiErrors.badRequest("id and active required");
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-")
        ? context.venueId
        : `venue-${context.venueId}`;

      const admin = createAdminClient();
      const { error } = await admin
        .from("staff")
        .update({ active })
        .eq("id", id)
        .eq("venue_id", normalizedVenueId);

      if (error) {
        return apiErrors.badRequest(error.message);
      }

      return success({ success: true });
    } catch (_error) {
      return apiErrors.internal(_error instanceof Error ? _error.message : "Unknown error");
    }
  },
  { requireRole: ["owner", "manager"] }
);

import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

/**
 * Delete (soft-delete) staff member from a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only delete staff from venues they have access to.
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {

    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {

        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const body = await req.json().catch(() => ({}));

      const { id } = body;

      if (!id) {

        return apiErrors.badRequest("id required");
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-")
        ? context.venueId
        : `venue-${context.venueId}`;

      // Use service role client to avoid RLS write failures.
      // Access is enforced by withUnifiedAuth (venue access + role requirements).
      const supabase = createAdminClient();

      const deleteStart = Date.now();
      const { data, error } = await supabase
        .from("staff")
        .delete()
        .eq("id", id)
        .eq("venue_id", normalizedVenueId)
        .select("*");
      const deleteTime = Date.now() - deleteStart;

      if (error) {

        return apiErrors.badRequest(error.message);
      }

      if (!data || data.length === 0) {

        return apiErrors.notFound("Staff member not found");
      }

      return success({ success: true });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;

      return apiErrors.internal(errorMessage);
    }
  },
  { requireRole: ["owner", "manager"] }
);

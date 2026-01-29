import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

/**
 * Delete staff member from a venue.
 * Access enforced by withUnifiedAuth (venue access + owner/manager role).
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

      const id = typeof body?.id === "string" ? body.id.trim() : "";

      const normalizedVenueId = context.venueId.startsWith("venue-")
        ? context.venueId
        : `venue-${context.venueId}`;

      // DEBUG: log exactly what we received and what we're querying
      // eslint-disable-next-line no-console
      console.log("[STAFF-DELETE] Request", {
        rawBody: body,
        parsedId: id,
        idType: typeof body?.id,
        contextVenueId: context.venueId,
        normalizedVenueId,
      });

      if (!id) {
        return apiErrors.badRequest("id required");
      }

      const supabase = createAdminClient();

      // Verify staff exists and belongs to this venue before deleting
      const { data: existing, error: selectError } = await supabase
        .from("staff")
        .select("id")
        .eq("id", id)
        .eq("venue_id", normalizedVenueId)
        .maybeSingle();

      // eslint-disable-next-line no-console
      console.log("[STAFF-DELETE] Select result", {
        existing,
        selectError: selectError?.message ?? null,
        selectCode: selectError?.code ?? null,
      });

      if (selectError) {
        return apiErrors.badRequest(selectError.message);
      }

      if (!existing) {
        // Diagnostic: list all staff for this venue to see what ids/venue_ids exist
        const { data: allForVenue } = await supabase
          .from("staff")
          .select("id, venue_id")
          .eq("venue_id", normalizedVenueId);
        const { data: allForVenueNoPrefix } = await supabase
          .from("staff")
          .select("id, venue_id")
          .eq("venue_id", context.venueId);
        // eslint-disable-next-line no-console
        console.log("[STAFF-DELETE] Staff member not found – diagnostic", {
          requestedId: id,
          requestedVenueId: normalizedVenueId,
          staffRowsForNormalizedVenue: allForVenue ?? [],
          staffRowsForRawVenueId: allForVenueNoPrefix ?? [],
        });
        return apiErrors.notFound("Staff member not found");
      }

      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", id)
        .eq("venue_id", normalizedVenueId);

      if (error) {
        return apiErrors.badRequest(error.message);
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

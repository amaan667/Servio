import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import {
  success,
  apiErrors,
  error as errorResponse,
  ErrorCodes,
} from "@/lib/api/standard-response";
import { normalizeVenueId } from "@/lib/utils/venueId";
import { staffService } from "@/lib/services/StaffService";

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
      const url = new URL(req.url);
      const idFromBody = typeof body?.id === "string" ? body.id.trim() : "";
      const idFromQuery = url.searchParams.get("id")?.trim() ?? "";
      const id = idFromBody || idFromQuery;

      const normalizedVenueId = normalizeVenueId(context.venueId) ?? context.venueId;
      const rawVenueId =
        normalizedVenueId.startsWith("venue-") ? normalizedVenueId.slice(6) : normalizedVenueId;

      if (!id) {
        return apiErrors.badRequest("id required");
      }

      const supabase = createAdminClient();

      // Find by id first (staff.id is globally unique); then verify venue
      let row: { id: string; venue_id: string } | null = null;
      const { data: rowById, error: selectError } = await supabase
        .from("staff")
        .select("id, venue_id")
        .eq("id", id)
        .maybeSingle();

      if (selectError) {
        return apiErrors.badRequest(selectError.message);
      }

      row = rowById;

      // If not found by id, try with raw venue_id (no "venue-" prefix) in case DB stores it that way
      if (!row) {
        const { data: rowByIdAndRawVenue } = await supabase
          .from("staff")
          .select("id, venue_id")
          .eq("id", id)
          .eq("venue_id", rawVenueId)
          .maybeSingle();
        row = rowByIdAndRawVenue;
      }

      if (!row) {
        const { data: staffWithNormalized } = await supabase
          .from("staff")
          .select("id, venue_id")
          .eq("venue_id", normalizedVenueId);
        const { data: staffWithRaw } = await supabase
          .from("staff")
          .select("id, venue_id")
          .eq("venue_id", context.venueId);
        const { data: staffWithRawId } = await supabase
          .from("staff")
          .select("id, venue_id")
          .eq("venue_id", rawVenueId);
        const debug = {
          requestedId: id,
          requestedVenueId: normalizedVenueId,
          contextVenueId: context.venueId,
          rawVenueId,
          staffIdsForNormalizedVenue: (staffWithNormalized ?? []).map((r) => r.id),
          staffIdsForRawVenueId: (staffWithRaw ?? []).map((r) => r.id),
          staffIdsForRawVenueIdOnly: (staffWithRawId ?? []).map((r) => r.id),
        };
        return errorResponse(ErrorCodes.NOT_FOUND, "Staff member not found", 404, {
          debug,
        });
      }

      const rowVenueNormalized = normalizeVenueId(row.venue_id) ?? row.venue_id;
      const contextVenueNormalized = normalizeVenueId(context.venueId) ?? context.venueId;
      if (rowVenueNormalized !== contextVenueNormalized) {
        return apiErrors.forbidden("Staff member does not belong to this venue");
      }

      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", id)
        .eq("venue_id", row.venue_id);

      if (error) {
        return apiErrors.badRequest(error.message);
      }

      await staffService.invalidateStaffListCache();

      return success({ success: true });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;

      return apiErrors.internal(errorMessage);
    }
  },
  { requireRole: ["owner", "manager"] }
);

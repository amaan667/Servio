import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";
import { getRequestMetadata, getIdempotencyKey } from "@/lib/api/request-helpers";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";

export const runtime = "nodejs";

/**
 * Add staff member to a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only add staff to venues they have access to.
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const requestMetadata = getRequestMetadata(req);
    const requestId = requestMetadata.correlationId;

    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {

        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
      }

      const body = await req.json().catch(() => ({}));

      // Optional idempotency check (non-breaking - only if header is provided)
      const idempotencyKey = getIdempotencyKey(req);
      if (idempotencyKey) {
        const existing = await checkIdempotency(idempotencyKey);
        if (existing.exists) {
          return success(
            existing.response.response_data as unknown,
            { timestamp: new Date().toISOString(), requestId },
            requestId
          );
        }
      }

      const { name, role } = body || {};

      if (!name) {

        return apiErrors.badRequest("name is required");
      }

      // Check tier limits for staff count
      const { checkLimit } = await import("@/lib/tier-restrictions");
      const supabase = createAdminClient();

      // Get venue owner to check tier limits
      const normalizedVenueId = context.venueId.startsWith("venue-")
        ? context.venueId
        : `venue-${context.venueId}`;

      const { data: venue } = await supabase
        .from("venues")
        .select("owner_user_id")
        .eq("venue_id", normalizedVenueId)
        .single();

      if (!venue) {
        return apiErrors.notFound("Venue not found");
      }

      // Count current staff (active user_venue_roles)
      const { count: currentStaffCount } = await supabase
        .from("user_venue_roles")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", normalizedVenueId);

      const staffCount = currentStaffCount || 0;

      // Check tier limit
      // IMPORTANT: Tier limits are based on the venue owner's subscription
      const limitCheck = await checkLimit(venue.owner_user_id, "maxStaff", staffCount);
      if (!limitCheck.allowed) {

        return apiErrors.forbidden(
          `Staff limit reached. You have ${staffCount}/${limitCheck.limit} staff members. Upgrade to ${limitCheck.currentTier === "starter" ? "Pro" : "Enterprise"} tier for more staff.`,
          {
            limitReached: true,
            currentCount: staffCount,
            limit: limitCheck.limit,
            tier: limitCheck.currentTier,
          }
        );
      }

      const insertData = {
        venue_id: normalizedVenueId,
        name,
        role: role || "Server",
        active: true,
      };

      // Use service role client to avoid RLS write failures.
      // Access is enforced by withUnifiedAuth (venue access + role requirements).
      // Note: supabase already created above for limit check
      const queryStart = Date.now();
      const { data, error } = await supabase.from("staff").insert([insertData]).select("*");
      const queryTime = Date.now() - queryStart;

      if (error) {

        return apiErrors.badRequest(error.message || "Failed to add staff member");
      }

      if (!data || data.length === 0) {

        return apiErrors.internal("Failed to create staff member - no data returned", undefined, requestId);
      }

      const response = data[0];

      // Store idempotency key if provided (non-breaking - only if header was sent)
      if (idempotencyKey) {
        const requestHash = JSON.stringify(body);
        await storeIdempotency(
          idempotencyKey,
          requestHash,
          response,
          200,
          3600 // 1 hour TTL
        ).catch(() => {
          // Don't fail request if idempotency storage fails
        });
      }

      return success(response, { timestamp: new Date().toISOString(), requestId }, requestId);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;

      return apiErrors.internal(errorMessage, undefined, requestId);
    }
  },
  { requireRole: ["owner", "manager"] }
);

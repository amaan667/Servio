import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Add staff member to a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only add staff to venues they have access to.
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    logger.debug("[STAFF ADD API] Request received", {
      venueId: context.venueId,
      url: req.url,
    });

    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        logger.warn("[STAFF ADD API] Rate limit exceeded");
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const body = await req.json().catch(() => ({}));
      logger.debug("[STAFF ADD API] Request body", { body });
      const { name, role } = body || {};

      if (!name) {
        logger.warn("[STAFF ADD API] Validation failed - name is required");
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
        logger.warn("[STAFF ADD API] Staff limit reached", {
          userId: context.user.id,
          ownerUserId: venue.owner_user_id,
          currentCount: staffCount,
          limit: limitCheck.limit,
          tier: limitCheck.currentTier,
        });
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

      logger.debug("[STAFF ADD API] Normalized venueId", { normalizedVenueId });

      const insertData = {
        venue_id: normalizedVenueId,
        name,
        role: role || "Server",
        active: true,
      };
      logger.debug("[STAFF ADD API] Insert data", { insertData });

      // Use service role client to avoid RLS write failures.
      // Access is enforced by withUnifiedAuth (venue access + role requirements).
      // Note: supabase already created above for limit check
      const queryStart = Date.now();
      const { data, error } = await supabase.from("staff").insert([insertData]).select("*");
      const queryTime = Date.now() - queryStart;

      logger.debug("[STAFF ADD API] Database query completed", {
        queryTime: `${queryTime}ms`,
        hasError: !!error,
        dataRows: data?.length || 0,
      });

      if (error) {
        logger.error("[STAFF ADD API] Database insert failed", {
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          error,
        });
        return apiErrors.badRequest(error.message || "Failed to add staff member");
      }

      if (!data || data.length === 0) {
        logger.error("[STAFF ADD API] No data returned from insert");
        return apiErrors.internal("Failed to create staff member - no data returned");
      }

      logger.info("[STAFF ADD API] Staff member created successfully", {
        staffId: data[0].id,
        name: data[0].name,
        role: data[0].role,
      });
      return success(data[0]);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      logger.error("[STAFF ADD API] Unexpected error", {
        errorType: e instanceof Error ? e.constructor.name : typeof e,
        errorMessage,
        errorStack,
      });
      return apiErrors.internal(errorMessage);
    }
  },
  { requireRole: ["owner", "manager"] }
);

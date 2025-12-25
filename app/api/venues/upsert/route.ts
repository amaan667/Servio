import { success, apiErrors } from "@/lib/api/standard-response";
import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    const body = await req.json();
    const { name, business_type, address, phone, email } = body;
    const finalVenueId = context.venueId || body.venueId;
    const user = context.user;

    if (!finalVenueId || !name || !business_type) {
      return apiErrors.badRequest("finalVenueId, name, and business_type required");
    }

    const admin = await createClient();

    // Check if venue exists and user owns it
    const { data: existingVenue } = await admin
      .from("venues")
      .select("id, owner_user_id")
      .eq("venue_id", finalVenueId)
      .maybeSingle();

    if (existingVenue && existingVenue.owner_user_id !== user.id) {
      return apiErrors.forbidden("Forbidden");
    }

    // Check tier limits for venue count (only when creating new venue)
    if (!existingVenue) {
      const { checkLimit } = await import("@/lib/tier-restrictions");

      // Count current venues owned by user
      const { count: currentVenueCount } = await admin
        .from("venues")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", user.id);

      const venueCount = currentVenueCount || 0;

      // Check tier limit
      const limitCheck = await checkLimit(user.id, "maxVenues", venueCount);
      if (!limitCheck.allowed) {
        logger.warn("[VENUES UPSERT] Venue limit reached", {
          userId: user.id,
          currentCount: venueCount,
          limit: limitCheck.limit,
          tier: limitCheck.currentTier,
        });
        return apiErrors.forbidden(
          `Location limit reached. You have ${venueCount}/${limitCheck.limit} location${venueCount !== 1 ? "s" : ""}. Upgrade to ${limitCheck.currentTier === "starter" ? "Pro" : "Enterprise"} tier for more locations.`,
          {
            limitReached: true,
            currentCount: venueCount,
            limit: limitCheck.limit,
            tier: limitCheck.currentTier,
          }
        );
      }
    }

    const venueData = {
      venue_id: finalVenueId,
      venue_name: name,
      business_type: business_type.toLowerCase(),
      address: address || null,
      phone: phone || null,
      email: email || null,
      owner_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (existingVenue) {
      // Update existing venue
      const { data, error } = await admin
        .from("venues")
        .update(venueData)
        .eq("id", existingVenue.id)
        .select()
        .single();

      // Invalidate venue cache
      await cache.invalidate(`venue:${finalVenueId}`);

      if (error) {
        logger.error("[VENUES UPSERT] Database error", { error: error.message });
        return apiErrors.database(error.message);
      }
      return success({ venue: data });
    } else {
      // Create new venue
      const newVenueData = {
        ...venueData,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("venues").insert(newVenueData).select().single();

      if (error) {
        logger.error("[VENUES UPSERT] Database error", { error: error.message });
        return apiErrors.database(error.message);
      }
      return success({ venue: data });
    }
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[VENUES UPSERT] Error", {
      error: errorMessage,
    });
    return apiErrors.internal(errorMessage);
  }
});

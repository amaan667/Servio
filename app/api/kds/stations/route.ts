import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const createStationSchema = z.object({
  stationName: z.string().min(1, "Station name is required"),
  stationType: z.string().optional().default("general"),
  displayOrder: z.number().int().optional().default(0),
  colorCode: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color code")
    .optional()
    .default("#3b82f6"),
});

// GET - Fetch all KDS stations for a venue
export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context (already verified)
    const venueId = context.venueId;

    // Log auth info for debugging - this will show in response headers
    const authInfo = {
      userId: context.user.id,
      email: context.user.email,
      tier: context.tier,
      role: context.role,
      venueId: context.venueId,
      timestamp: new Date().toISOString(),
      endpoint: "/api/kds/stations",
    };

    // eslint-disable-next-line no-console
    console.log("[API-KDS-STATIONS] ========== REQUEST RECEIVED ==========", authInfo);

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Business logic - Fetch stations
    const supabase = createAdminClient();

    const { data: stations, error: fetchError } = await supabase
      .from("kds_stations")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (fetchError) {
      return apiErrors.database("Failed to fetch KDS stations");
    }

    // If no stations exist, create default ones
    if (!stations || stations.length === 0) {
      const { error: setupError } = await supabase.rpc("setup_default_kds_stations", {
        p_venue_id: venueId,
      });

      if (!setupError) {
        // Fetch again after setup
        const { data: newStations } = await supabase
          .from("kds_stations")
          .select("*")
          .eq("venue_id", venueId)
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        return success({ stations: newStations || [] });
      }
    }

    return success({ stations: stations || [] });
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.KDS,
  }
);

// POST - Create a new KDS station
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context (already verified)
    const venueId = context.venueId;
    const { body } = context;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Check KDS station limit based on tier
    const { checkKDSStationLimit } = await import("@/lib/tier-restrictions");
    const supabase = createAdminClient();

    // Get venue owner for tier check
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", venueId)
      .single();

    if (!venue) {
      return apiErrors.notFound("Venue not found");
    }

    // Count current stations for this venue
    const { count: currentStationCount } = await supabase
      .from("kds_stations")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("is_active", true);

    const stationLimitCheck = await checkKDSStationLimit(
      venue.owner_user_id,
      currentStationCount || 0
    );

    if (!stationLimitCheck.allowed) {
      if (stationLimitCheck.kdsTier === "basic") {
        return apiErrors.forbidden(
          `Station limit reached. Basic KDS supports only 1 station. Upgrade to Pro or Enterprise for unlimited stations.`,
          {
            limitReached: true,
            currentCount: currentStationCount || 0,
            limit: stationLimitCheck.limit,
            tier: stationLimitCheck.currentTier,
            kdsTier: stationLimitCheck.kdsTier,
          }
        );
      }

      return apiErrors.forbidden(
        `Station limit reached. You have ${currentStationCount || 0}/${stationLimitCheck.limit} stations.`,
        {
          limitReached: true,
          currentCount: currentStationCount || 0,
          limit: stationLimitCheck.limit,
          tier: stationLimitCheck.currentTier,
        }
      );
    }

    // Business logic - Create station
    const { data: station, error: insertError } = await supabase
      .from("kds_stations")
      .insert({
        venue_id: venueId,
        station_name: body.stationName,
        station_type: body.stationType || "general",
        display_order: body.displayOrder || 0,
        color_code: body.colorCode || "#3b82f6",
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !station) {
      return apiErrors.database("Failed to create KDS station");
    }

    return success({ station });
  },
  {
    schema: createStationSchema,
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.KDS,
  }
);

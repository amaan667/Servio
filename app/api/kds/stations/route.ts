import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

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
export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Business logic - Fetch stations
    const supabase = createAdminClient();

    const { data: stations, error: fetchError } = await supabase
      .from("kds_stations")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (fetchError) {
      logger.error("[KDS STATIONS] Error fetching stations:", {
        error: fetchError.message,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.database(
        "Failed to fetch KDS stations",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    // If no stations exist, create default ones
    if (!stations || stations.length === 0) {
      const { error: setupError } = await supabase.rpc("setup_default_kds_stations", {
        p_venue_id: venueId,
      });

      if (setupError) {
        logger.error("[KDS STATIONS] Error setting up default stations:", {
          error: setupError.message,
          venueId,
          userId: context.user.id,
        });
        // Continue anyway - return empty array
      } else {
        // Fetch again after setup
        const { data: newStations, error: refetchError } = await supabase
          .from("kds_stations")
          .select("*")
          .eq("venue_id", venueId)
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (refetchError) {
          logger.error("[KDS STATIONS] Error refetching stations after setup:", {
            error: refetchError.message,
            venueId,
            userId: context.user.id,
          });
        }

        logger.info("[KDS STATIONS] Stations fetched successfully", {
          venueId,
          stationCount: newStations?.length || 0,
          userId: context.user.id,
        });

        return success({ stations: newStations || [] });
      }
    }

    logger.info("[KDS STATIONS] Stations fetched successfully", {
      venueId,
      stationCount: stations?.length || 0,
      userId: context.user.id,
    });

    // STEP 4: Return success response
    return success({ stations: stations || [] });
  } catch (error) {
    logger.error("[KDS STATIONS] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      venueId: context.venueId,
      userId: context.user.id,
    });

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

// POST - Create a new KDS station
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Validate input
    const body = await validateBody(createStationSchema, await req.json());

    // STEP 3: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 4: Check KDS station limit based on tier
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
      logger.warn("[KDS STATIONS POST] Station limit reached", {
        userId: context.user.id,
        ownerUserId: venue.owner_user_id,
        currentCount: currentStationCount || 0,
        limit: stationLimitCheck.limit,
        tier: stationLimitCheck.currentTier,
        kdsTier: stationLimitCheck.kdsTier,
      });

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

    // STEP 5: Business logic - Create station

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
      logger.error("[KDS STATIONS] Error creating station:", {
        error: insertError?.message,
        venueId,
        userId: context.user.id,
        stationName: body.stationName,
      });
      return apiErrors.database(
        "Failed to create KDS station",
        isDevelopment() ? insertError?.message : undefined
      );
    }

    logger.info("[KDS STATIONS] Station created successfully", {
      venueId,
      stationId: station.id,
      stationName: body.stationName,
      userId: context.user.id,
    });

    // STEP 5: Return success response
    return success({ station });
  } catch (error) {
    logger.error("[KDS STATIONS] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      venueId: context.venueId,
      userId: context.user.id,
    });

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

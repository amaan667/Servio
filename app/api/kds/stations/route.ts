import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const createStationSchema = z.object({
  stationName: z.string().min(1, "Station name is required"),

    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color code")
    .optional()
    .default("#3b82f6"),

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
      
      return apiErrors.database(
        "Failed to fetch KDS stations",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    // If no stations exist, create default ones
    if (!stations || stations.length === 0) {
      const { error: setupError } = await supabase.rpc("setup_default_kds_stations", {

      if (setupError) {
        
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
          
        }

        

        return success({ stations: newStations || [] });
      }
    }

    

    // STEP 4: Return success response
    return success({ stations: stations || [] });
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }

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
      

      if (stationLimitCheck.kdsTier === "basic") {
        return apiErrors.forbidden(
          `Station limit reached. Basic KDS supports only 1 station. Upgrade to Pro or Enterprise for unlimited stations.`,
          {

          }
        );
      }

      return apiErrors.forbidden(
        `Station limit reached. You have ${currentStationCount || 0}/${stationLimitCheck.limit} stations.`,
        {

        }
      );
    }

    // STEP 5: Business logic - Create station

    const { data: station, error: insertError } = await supabase
      .from("kds_stations")
      .insert({

      .select()
      .single();

    if (insertError || !station) {
      
      return apiErrors.database(
        "Failed to create KDS station",
        isDevelopment() ? insertError?.message : undefined
      );
    }

    

    // STEP 5: Return success response
    return success({ station });
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }

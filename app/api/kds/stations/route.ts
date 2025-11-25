import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// GET - Fetch all KDS stations for a venue
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const venueId = context.venueId;

      logger.debug("[KDS STATIONS] Request received:", {
        venueId,
        hasAuthHeader: !!req.headers.get("authorization"),
        authHeader: req.headers.get("authorization")?.substring(0, 20) + "...",
      });

      const supabase = createAdminClient();

    // Get stations for this venue
    const { data: stations, error } = await supabase
      .from("kds_stations")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      logger.error("[KDS] Error fetching stations:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // If no stations exist, create default ones
    if (!stations || stations.length === 0) {
      const { error: setupError } = await supabase.rpc("setup_default_kds_stations", {
        p_venue_id: venueId,
      });

      if (setupError) {
        logger.error("[KDS] Error setting up default stations:", { error: setupError.message });
      }

      // Fetch again after setup
      const { data: newStations } = await supabase
        .from("kds_stations")
        .select("*")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      return NextResponse.json({
        ok: true,
        stations: newStations || [],
      });
    }

      return NextResponse.json({
        ok: true,
        stations,
      });
    } catch (_error) {
      logger.error("[KDS] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json(
        { ok: false, error: _error instanceof Error ? _error.message : "Internal server _error" },
        { status: 500 }
      );
    }
  }
);

// POST - Create a new KDS station
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      const body = await req.json();
      const { stationName, stationType, displayOrder, colorCode } = body;
      const venueId = context.venueId;

      if (!venueId || !stationName) {
        return NextResponse.json(
          { ok: false, error: "venueId and stationName are required" },
          { status: 400 }
        );
      }

      const supabase = createAdminClient();

    const { data: station, error } = await supabase
      .from("kds_stations")
      .insert({
        venue_id: venueId,
        station_name: stationName,
        station_type: stationType || "general",
        display_order: displayOrder || 0,
        color_code: colorCode || "#3b82f6",
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error("[KDS] Error creating station:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

      return NextResponse.json({
        ok: true,
        station,
      });
    } catch (_error) {
      logger.error("[KDS] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json(
        { ok: false, error: _error instanceof Error ? _error.message : "Internal server _error" },
        { status: 500 }
      );
    }
  }
);

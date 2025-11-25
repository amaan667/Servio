import { NextResponse } from "next/server";
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

// GET - Fetch all KDS stations for a venue
export async function GET(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI(req);
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

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

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId is required" }, { status: 400 });
    }

    logger.debug("[KDS STATIONS] Request received:", {
      venueId,
      hasAuthHeader: !!req.headers.get("authorization"),
      authHeader: req.headers.get("authorization")?.substring(0, 20) + "...",
    });

    // Authenticate request
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }


    const { user, supabase } = auth;

    // Verify venue access
    const access = await verifyVenueAccess(supabase, user.id, venueId);
    if (!access.hasAccess) {
      logger.warn("[KDS] User does not have access to venue:", { userId: user.id, venueId });
      return NextResponse.json(
        { ok: false, error: "Access denied to this venue" },
        { status: 403 }
      );
    }

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

// POST - Create a new KDS station
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venueId, stationName, stationType, displayOrder, colorCode } = body;

    if (!venueId || !stationName) {
      return NextResponse.json(
        { ok: false, error: "venueId and stationName are required" },
        { status: 400 }
      );
    }

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }

    const { user, supabase } = auth;

    // Verify venue access
    const access = await verifyVenueAccess(supabase, user.id, venueId);
    if (!access.hasAccess) {
      logger.warn("[KDS] User does not have access to venue:", { userId: user.id, venueId });
      return NextResponse.json(
        { ok: false, error: "Access denied to this venue" },
        { status: 403 }
      );
    }

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

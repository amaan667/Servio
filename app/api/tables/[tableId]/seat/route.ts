import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// POST /api/tables/[tableId]/seat - Seat a party at a table
export async function POST(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
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
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
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
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const { tableId } = await context.params;
    const body = await req.json();
    const { reservationId, serverId } = body;

    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId is required" }, { status: 400 });
    }

    // Use admin client - no auth needed
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Get table info
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", tableId)
      .single();

    if (tableError || !table) {
      return NextResponse.json({ ok: false, error: "Table not found" }, { status: 404 });
    }

    // Call the database function to seat the party
    const { error } = await supabase.rpc("api_seat_party", {
      p_table_id: tableId,
      p_venue_id: table.venue_id,
      p_reservation_id: reservationId || null,
      p_server_id: serverId || null,
    });

    if (error) {
      logger.error("[TABLES SEAT] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "Party seated successfully",
    });
  } catch (_error) {
    logger.error("[TABLES SEAT] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

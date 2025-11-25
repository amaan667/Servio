import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(_request: NextRequest) {
  try {
    const req = _request;

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

    const { venue_id } = await _request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: "venue_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Clear table runtime state - reset all tables to FREE status
    const { error: runtimeStateError } = await supabase
      .from("table_runtime_state")
      .update({
        primary_status: "FREE",
        session_id: null,
        opened_at: null,
        server_id: null,
        reservation_status: "NONE",
        reserved_now_id: null,
        reserved_now_start: null,
        reserved_now_end: null,
        reserved_now_party_size: null,
        reserved_now_name: null,
        reserved_now_phone: null,
        next_reservation_id: null,
        next_reservation_start: null,
        next_reservation_end: null,
        next_reservation_party_size: null,
        next_reservation_name: null,
        next_reservation_phone: null,
      })
      .eq("venue_id", venue_id);

    if (runtimeStateError) {
      logger.error("[AUTH DEBUG] Error clearing table runtime state:", runtimeStateError);
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to clear table runtime state: ${runtimeStateError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Table runtime state cleared successfully",
    });
  } catch (_error) {
    logger.error("[AUTH DEBUG] Error in clear tables API:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

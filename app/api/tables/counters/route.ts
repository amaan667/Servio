import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// GET /api/tables/counters?venueId=xxx - Get table counters for dashboard
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

    

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
    }

    // Use admin client - no auth needed (venueId is sufficient)
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Call the database function to get counters
    const { data: counters, error } = await supabase.rpc("api_table_counters", {
      p_venue_id: venueId,
    });

    if (error) {
      logger.error("[TABLES COUNTERS] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // The function returns a single row with all counters
    const counter = counters?.[0] || {
      total_tables: 0,
      available: 0,
      occupied: 0,
      reserved_now: 0,
      reserved_later: 0,
      block_window_mins: 0,
    };

    // Also get real-time counts for verification
    const { data: realtimeCounts, error: realtimeError } = await supabase.rpc(
      "get_realtime_table_counts",
      {
        p_venue_id: venueId,
      }
    );

    if (realtimeError) {
      logger.error("[TABLES COUNTERS] Realtime error:", realtimeError);
    } else {
      // Intentionally empty
    }

    return NextResponse.json({
      ok: true,
      counters: {
        total_tables: Number(counter.total_tables),
        available: Number(counter.available),
        occupied: Number(counter.occupied),
        reserved_now: Number(counter.reserved_now),
        reserved_later: Number(counter.reserved_later),
        block_window_mins: Number(counter.block_window_mins),
      },
    });
  } catch (_error) {
    logger.error("[TABLES COUNTERS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NUCLEAR OPTION: Clear ALL table sessions for a venue
 * Call: POST /api/tables/clear-all
 * Body: { "venueId": "venue-1e02af4d" }
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const finalVenueId = venueId || body.venueId;

    if (!finalVenueId) {
      return NextResponse.json({ ok: false, error: "finalVenueId required" }, { status: 400 });
    }

    const { createAdminClient } = await import("@/lib/supabase");
    const admin = createAdminClient();

    // Get all table sessions for this venue
    const { data: sessions, error: fetchError } = await admin
      .from("table_sessions")
      .select("*")
      .eq("venue_id", finalVenueId);

    if (fetchError) {
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    if (sessions) {
      sessions.forEach((_session: unknown) => {
        // Iterate through sessions (no action needed)
        void _session;
      });
    }

    // Close ALL table sessions for this venue
    const { data: updated, error: updateError } = await admin
      .from("table_sessions")
      .update({
        status: "FREE",
        order_id: null,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", finalVenueId)
      .select("id, table_id");

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    logger.debug("[CLEAR ALL TABLES] Cleared all table sessions", {
      finalVenueId,
      count: updated?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      message: `Cleared ${updated?.length || 0} table sessions`,
      cleared: updated?.length || 0,
    });
  } catch (_error) {
    logger.error("[CLEAR ALL TABLES] Error:", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

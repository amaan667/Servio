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

    // Step 1: Force clear ALL table references from orders (including completed ones)
    const { error: clearAllRefsError } = await supabase
      .from("orders")
      .update({ table_id: null })
      .eq("venue_id", venue_id);

    if (clearAllRefsError) {
      logger.error("[FORCE CLEAR ALL] Error clearing table references:", clearAllRefsError);
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to clear table references: ${clearAllRefsError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 2: Delete all table sessions
    const { error: sessionsError } = await supabase
      .from("table_sessions")
      .delete()
      .eq("venue_id", venue_id);

    if (sessionsError) {
      logger.error("[FORCE CLEAR ALL] Error deleting table sessions:", sessionsError);
      // Continue anyway
    } else {
      // Intentionally empty
    }

    // Step 3: Delete all tables
    const { error: tablesError } = await supabase.from("tables").delete().eq("venue_id", venue_id);

    if (tablesError) {
      logger.error("[FORCE CLEAR ALL] Error deleting tables:", tablesError);
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to delete tables: ${tablesError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 4: Clear table runtime state
    const { error: runtimeError } = await supabase
      .from("table_runtime_state")
      .delete()
      .eq("venue_id", venue_id);

    if (runtimeError) {
      logger.error("[FORCE CLEAR ALL] Error clearing runtime state:", runtimeError);
      // Continue anyway
    } else {
      // Intentionally empty
    }

    // Step 5: Clear group sessions
    const { error: groupSessionsError } = await supabase
      .from("table_group_sessions")
      .delete()
      .eq("venue_id", venue_id);

    if (groupSessionsError) {
      logger.error("[FORCE CLEAR ALL] Error clearing group sessions:", groupSessionsError);
      // Continue anyway
    } else {
      // Intentionally empty
    }

    return NextResponse.json({
      ok: true,
      message: "All tables and sessions force cleared successfully",
    });
  } catch (_error) {
    logger.error("[FORCE CLEAR ALL] Error in force clear all tables API:", {
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

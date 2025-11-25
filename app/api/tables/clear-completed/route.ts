import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clear tables for all completed/cancelled orders
 * Call: POST /api/tables/clear-completed
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

    const admin = createAdminClient();

    // Get all completed/cancelled orders
    const { data: completedOrders } = await admin
      .from("orders")
      .select("id, venue_id, table_id, table_number, order_status")
      .in("order_status", ["COMPLETED", "CANCELLED", "REFUNDED"]);

    if (!completedOrders || completedOrders.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No tables to clear",
        cleared: 0,
      });
    }

    // Get order IDs
    const orderIds = completedOrders.map((o: { id: string }) => o.id);

    // Close table sessions for these orders
    const { data: clearedSessions, error: clearError } = await admin
      .from("table_sessions")
      .update({
        status: "FREE",
        order_id: null,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("order_id", orderIds)
      .is("closed_at", null)
      .select("id, table_id, venue_id");

    if (clearError) {
      return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
    }

    logger.debug("[CLEAR COMPLETED TABLES] Cleared table sessions", {
      count: clearedSessions?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      message: `Cleared ${clearedSessions?.length || 0} table sessions`,
      cleared: clearedSessions?.length || 0,
      orderIds: orderIds,
    });
  } catch (_error) {
    logger.error("[CLEAR COMPLETED TABLES] Error:", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

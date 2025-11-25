import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// GET /api/reservations?venueId=xxx - Get reservations for a venue
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

    const status = searchParams.get("status") || "all";

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
    }

    // Use admin client - no auth needed (venueId is sufficient)
    const supabase = createAdminClient();

    // Build query
    let query = supabase
      .from("reservations")
      .select(
        `
        id,
        venue_id,
        table_id,
        customer_name,
        customer_phone,
        start_at,
        end_at,
        party_size,
        status,
        created_at,
        updated_at,
        tables(label)
      `
      )
      .eq("venue_id", venueId)
      .order("start_at", { ascending: true });

    // Apply status filter
    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: reservations, error } = await query;

    if (error) {
      logger.error("[RESERVATIONS GET] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reservations: reservations || [],
    });
  } catch (_error) {
    logger.error("[RESERVATIONS GET] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/reservations - Create a new reservation
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venueId, tableId, customerName, customerPhone, startAt, endAt, partySize } = body;

    if (!venueId || !customerName || !startAt || !endAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId, customerName, startAt, and endAt are required",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Create reservation
    const { data: reservation, error } = await supabase
      .from("reservations")
      .insert({
        venue_id: venueId,
        table_id: tableId || null, // Can be null for unassigned reservations
        customer_name: customerName,
        customer_phone: customerPhone || null,
        start_at: startAt,
        end_at: endAt,
        party_size: partySize || 2,
        status: "BOOKED",
      })
      .select()
      .single();

    if (error) {
      logger.error("[RESERVATIONS POST] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reservation: reservation,
    });
  } catch (_error) {
    logger.error("[RESERVATIONS POST] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

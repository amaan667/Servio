import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

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

    const { reservationId, tableId } = await req.json();

    if (!reservationId || !tableId) {
      return NextResponse.json(
        {
          ok: false,
          error: "reservationId and tableId are required",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Get reservation to validate it exists
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("venue_id")
      .eq("id", reservationId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reservation not found",
        },
        { status: 404 }
      );
    }

    // Update reservation status to CHECKED_IN
    const { data: updatedReservation, error: updateError } = await supabase
      .from("reservations")
      .update({
        status: "CHECKED_IN",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select()
      .single();

    if (updateError) {
      logger.error("[CHECKIN] Error updating reservation:", updateError);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check in reservation",
        },
        { status: 500 }
      );
    }

    // Also update the table session to OCCUPIED if it's not already
    const { error: tableError } = await supabase.from("table_sessions").upsert(
      {
        table_id: tableId,
        status: "OCCUPIED",
        opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "table_id",
      }
    );

    if (tableError) {
      logger.error("[CHECKIN] Error updating table session:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      ok: true,
      reservation: updatedReservation,
    });
  } catch (_error) {
    logger.error("[CHECKIN] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Internal server _error",
      },
      { status: 500 }
    );
  }
}

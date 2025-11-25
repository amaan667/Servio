import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
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
    const { tableId, startAt, endAt, partySize, name, phone } = body;
    const finalVenueId = venueId || body.venueId;

    // Validate inputs
    if (!finalVenueId) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId is required",
        },
        { status: 400 }
      );
    }

    if (!startAt || !endAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "startAt and endAt are required",
        },
        { status: 400 }
      );
    }

    if (new Date(startAt) >= new Date(endAt)) {
      return NextResponse.json(
        {
          ok: false,
          error: "startAt must be before endAt",
        },
        { status: 400 }
      );
    }

    if (!partySize || partySize <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "partySize must be a positive integer",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = await createClient();

    // If tableId is provided, check if table exists
    if (tableId) {
      const { data: table } = await supabase
        .from("tables")
        .select("id")
        .eq("id", tableId)
        .eq("venue_id", finalVenueId)
        .maybeSingle();

      if (!table) {
        return NextResponse.json(
          {
            ok: false,
            error: "Table not found",
          },
          { status: 400 }
        );
      }
    }

    // Check for overlapping reservations if tableId is provided
    if (tableId) {
      const { data: overlappingReservations } = await supabase
        .from("reservations")
        .select("id")
        .eq("table_id", tableId)
        .eq("venue_id", finalVenueId)
        .in("status", ["BOOKED", "CHECKED_IN"])
        .or(`and(start_at.lt.${endAt},end_at.gt.${startAt})`);

      if (overlappingReservations && overlappingReservations.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Table is already reserved for this time period",
          },
          { status: 400 }
        );
      }
    }

    // Create the reservation
    const { data: reservation, error: createError } = await supabase
      .from("reservations")
      .insert({
        venue_id: finalVenueId,
        table_id: tableId,
        start_at: startAt,
        end_at: endAt,
        party_size: partySize,
        customer_name: name,
        customer_phone: phone,
        status: "BOOKED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      logger.error("[CREATE RESERVATION] Error:", createError);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to create reservation: " + createError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Reservation created successfully",
      reservation: reservation,
    });
  } catch (_error) {
    logger.error("[CREATE RESERVATION] Error:", {
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

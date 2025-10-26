import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthenticatedUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { venueId, tableId, startAt, endAt, partySize, name, phone } = await req.json();

    // Validate inputs
    if (!venueId) {
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

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json(
        {
          ok: false,
          error: "Venue not found or access denied",
        },
        { status: 403 }
      );
    }

    // If tableId is provided, check if table exists
    if (tableId) {
      const { data: table } = await supabase
        .from("tables")
        .select("id")
        .eq("id", tableId)
        .eq("venue_id", venueId)
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
        .eq("venue_id", venueId)
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
        venue_id: venueId,
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

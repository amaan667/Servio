import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
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

      // Validate inputs
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
            error: "endAt must be after startAt",
          },
          { status: 400 }
        );
      }

      if (!name) {
        return NextResponse.json(
          {
            ok: false,
            error: "name is required",
          },
          { status: 400 }
        );
      }

      const adminSupabase = createAdminClient();

      // Create reservation
      const { data: reservation, error: reservationError } = await adminSupabase
        .from("reservations")
        .insert({
          venue_id: context.venueId,
          table_id: tableId || null,
          start_at: startAt,
          end_at: endAt,
          party_size: partySize || 2,
          customer_name: name,
          customer_phone: phone || null,
          status: "BOOKED",
        })
        .select()
        .single();

      if (reservationError) {
        logger.error("[RESERVATIONS CREATE] Error creating reservation:", {
          error: reservationError instanceof Error ? reservationError.message : "Unknown error",
        });
        return NextResponse.json(
          {
            ok: false,
            error: reservationError.message || "Failed to create reservation",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        reservation,
      });
    } catch (_error) {
      logger.error("[RESERVATIONS CREATE] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json(
        {
          ok: false,
          error: _error instanceof Error ? _error.message : "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }
);

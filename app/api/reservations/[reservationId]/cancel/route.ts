import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// POST /api/reservations/[reservationId]/cancel - Cancel a reservation
export async function POST(req: NextRequest, context: { params: Promise<{ reservationId: string }> }) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
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

        const { reservationId } = await routeParams!.params!;

    if (!reservationId) {
      return NextResponse.json({ ok: false, error: "reservationId is required" }, { status: 400 });
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Get reservation to validate it exists
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("venue_id")
      .eq("id", reservationId)
      .eq("venue_id", authContext.venueId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json({ ok: false, error: "Reservation not found" }, { status: 404 });
    }

    // Call the database function to cancel reservation
    const { error } = await supabase.rpc("api_cancel_reservation", {
      p_reservation_id: reservationId,
    });

    if (error) {
      logger.error("[RESERVATIONS CANCEL] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

      return NextResponse.json({
        ok: true,
        message: "Reservation cancelled successfully",
      });
    } catch (_error) {
      logger.error("[RESERVATIONS CANCEL] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  },
  {
    extractVenueId: async (req, routeParams) => {
      // Get venueId from reservation record
      if (routeParams?.params) {
        const params = await routeParams.params;
        const reservationId = params?.reservationId;
        if (reservationId) {
          const adminSupabase = createAdminClient();
          const { data: reservation } = await adminSupabase
            .from("reservations")
            .select("venue_id")
            .eq("id", reservationId)
            .single();
          if (reservation?.venue_id) {
            return reservation.venue_id;
          }
        }
      }
      // Fallback to query/body
      const url = new URL(req.url);
      return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
    },
  }
);

  return handler(req, context);
}

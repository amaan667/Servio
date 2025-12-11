import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
      try {
        // CRITICAL: Rate limiting
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {
              error: "Too many requests",
              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            { status: 429 }
          );
        }

        const { reservationId } = await routeParams!.params!;
        const { customerName, startAt, endAt, partySize, customerPhone } = await req.json();

        if (!reservationId) {
          return NextResponse.json(
            {
              ok: false,
              error: "reservationId is required",
            },
            { status: 400 }
          );
        }

        if (!customerName || !startAt || !endAt || !partySize) {
          return NextResponse.json(
            {
              ok: false,
              error: "customerName, startAt, endAt, and partySize are required",
            },
            { status: 400 }
          );
        }

        // Use admin client - no auth needed
        const { createAdminClient } = await import("@/lib/supabase");
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

        // Update the reservation
        const { data: updatedReservation, error: updateError } = await supabase
          .from("reservations")
          .update({
            customer_name: customerName,
            start_at: startAt,
            end_at: endAt,
            party_size: partySize,
            customer_phone: customerPhone || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservationId)
          .eq("venue_id", authContext.venueId)
          .select()
          .single();

        if (updateError) {
          logger.error("[MODIFY RESERVATION] Error updating reservation:", updateError);
          return NextResponse.json(
            {
              ok: false,
              error: "Failed to modify reservation",
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          reservation: updatedReservation,
        });
      } catch (_error) {
        logger.error("[MODIFY RESERVATION] Error:", {
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

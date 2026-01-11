import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ReservationParams = { params?: { reservationId?: string } };

export async function PUT(req: NextRequest, context: ReservationParams = {}) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
      try {
        // CRITICAL: Rate limiting
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {

              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            { status: 429 }
          );
        }

        const params = routeParams?.params ?? {};
        const { reservationId } = params as { reservationId?: string };
        const { customerName, startAt, endAt, partySize, customerPhone } = await req.json();

        if (!reservationId) {
          return NextResponse.json(
            {

            },
            { status: 400 }
          );
        }

        if (!customerName || !startAt || !endAt || !partySize) {
          return NextResponse.json(
            {

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

            },
            { status: 404 }
          );
        }

        // Update the reservation
        const { data: updatedReservation, error: updateError } = await supabase
          .from("reservations")
          .update({

          .eq("id", reservationId)
          .eq("venue_id", authContext.venueId)
          .select()
          .single();

        if (updateError) {
          
          return NextResponse.json(
            {

            },
            { status: 500 }
          );
        }

        return NextResponse.json({

      } catch (_error) {
        
        return NextResponse.json(
          {

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

  return handler(req, { params: Promise.resolve(context.params ?? {}) } as {
    params?: Promise<Record<string, string>>;

}

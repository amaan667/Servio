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

    const body = await req.json();
    const finalVenueId = venueId || body.venueId;

    if (!finalVenueId) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId is required",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = await createClient();

    const now = new Date().toISOString();

    // Find reservations that should be auto-completed
    // 1. Time-based: reservations that have passed their end time
    // 2. Payment-based: CHECKED_IN reservations where all orders are paid and completed
    const { data: allActiveReservations, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("venue_id", venueId)
      .in("status", ["BOOKED", "CHECKED_IN"]);

    if (fetchError) {
      logger.error("[AUTO COMPLETE] Error fetching active reservations:", fetchError);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch active reservations",
        },
        { status: 500 }
      );
    }

    if (!allActiveReservations || allActiveReservations.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No active reservations found",
        completedCount: 0,
      });
    }

    const reservationsToComplete = [];

    for (const reservation of allActiveReservations) {
      let shouldComplete = false;
      let completionReason = "";

      // Check time-based completion
      if (new Date(reservation.end_at) < new Date(now)) {
        shouldComplete = true;
        completionReason = "time_expired";
      }
      // Check payment-based completion for CHECKED_IN reservations
      else if (reservation.status === "CHECKED_IN" && reservation.table_id) {
        // Find all orders for this table that are not completed
        const { data: activeOrders } = await supabase
          .from("orders")
          .select("id, payment_status, order_status")
          .eq("venue_id", finalVenueId)
          .eq("table_id", reservation.table_id)
          .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"]);

        // If there are no active orders, check if all orders are paid
        if (!activeOrders || activeOrders.length === 0) {
          const { data: allOrders } = await supabase
            .from("orders")
            .select("payment_status")
            .eq("venue_id", finalVenueId)
            .eq("table_id", reservation.table_id)
            .eq("payment_status", "PAID");

          // If there are paid orders and no active orders, complete the reservation
          if (allOrders && allOrders.length > 0) {
            shouldComplete = true;
            completionReason = "payment_completed";
          }
        }
      }

      if (shouldComplete) {
        reservationsToComplete.push({
          ...reservation,
          completionReason,
        });
      }
    }

    if (reservationsToComplete.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No reservations need to be completed",
        completedCount: 0,
      });
    }

    // Update reservations to COMPLETED status
    const { data: updatedReservations, error: updateError } = await supabase
      .from("reservations")
      .update({
        status: "COMPLETED",
        updated_at: now,
      })
      .in(
        "id",
        reservationsToComplete.map((r) => r.id)
      )
      .select();

    if (updateError) {
      logger.error("[AUTO COMPLETE] Error updating reservations:", updateError);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to complete reservations",
        },
        { status: 500 }
      );
    }

    // Also check if unknown tables should be set to FREE if they have no active orders
    for (const reservation of reservationsToComplete) {
      if (reservation.table_id) {
        // Check if there are unknown active orders for this table
        const { data: activeOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("table_id", reservation.table_id)
          .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"])
          .limit(1);

        // If no active orders, set table session to FREE
        if (!activeOrders || activeOrders.length === 0) {
          await supabase.from("table_sessions").upsert(
            {
              table_id: reservation.table_id,
              status: "FREE",
              closed_at: now,
              updated_at: now,
            },
            {
              onConflict: "table_id",
            }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Completed ${updatedReservations?.length || 0} reservations`,
      completedCount: updatedReservations?.length || 0,
      reservations: updatedReservations,
      completionReasons: reservationsToComplete.map((r) => ({
        id: r.id,
        reason: r.completionReason,
      })),
    });
  } catch (_error) {
    logger.error("[AUTO COMPLETE] Error:", {
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

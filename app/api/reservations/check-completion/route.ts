import { NextRequest, NextResponse } from "next/server";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
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

    const body = await req.json();
    const { tableId } = body;
    const finalVenueId = context.venueId;

    if (!finalVenueId || !tableId) {
      return NextResponse.json(
        {
          ok: false,
          error: "finalVenueId and tableId are required",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Find CHECKED_IN reservations for this table
    const { data: checkedInReservations, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("venue_id", finalVenueId)
      .eq("table_id", tableId)
      .eq("status", "CHECKED_IN");

    if (fetchError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch reservations",
        },
        { status: 500 }
      );
    }

    if (!checkedInReservations || checkedInReservations.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No checked-in reservations found for this table",
        completedCount: 0,
      });
    }

    const now = new Date().toISOString();
    const reservationsToComplete = [];

    for (const reservation of checkedInReservations) {
      // Check if all orders for this table are paid and completed
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("id, payment_status, order_status")
        .eq("venue_id", finalVenueId)
        .eq("table_id", tableId)
        .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"]);

      // If there are no active orders, check if all orders are paid
      if (!activeOrders || activeOrders.length === 0) {
        const { data: allOrders } = await supabase
          .from("orders")
          .select("payment_status")
          .eq("venue_id", finalVenueId)
          .eq("table_id", tableId)
          .eq("payment_status", "PAID");

        // If there are paid orders and no active orders, complete the reservation
        if (allOrders && allOrders.length > 0) {
          reservationsToComplete.push(reservation);
        }
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
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to complete reservations",
        },
        { status: 500 }
      );
    }

    // Set table session to FREE if no active orders
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("venue_id", finalVenueId)
      .eq("table_id", tableId)
      .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING"])
      .limit(1);

    if (!activeOrders || activeOrders.length === 0) {
      await supabase.from("table_sessions").upsert(
        {
          table_id: tableId,
          status: "FREE",
          closed_at: now,
          updated_at: now,
        },
        {
          onConflict: "table_id",
        }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Completed ${updatedReservations?.length || 0} reservations`,
      completedCount: updatedReservations?.length || 0,
      reservations: updatedReservations,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Internal server _error",
      },
      { status: 500 }
    );
  }
});

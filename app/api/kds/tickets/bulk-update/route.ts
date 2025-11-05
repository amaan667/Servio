import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// PATCH - Bulk update multiple tickets (e.g., bump all ready tickets for an order)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { orderId, stationId, status } = body;

    if (!status) {
      return NextResponse.json({ ok: false, error: "status is required" }, { status: 400 });
    }

    if (!orderId && !stationId) {
      return NextResponse.json(
        { ok: false, error: "Either orderId or stationId is required" },
        { status: 400 }
      );
    }

    const validStatuses = ["new", "in_progress", "ready", "bumped"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Use admin client - no authentication required for KDS feature
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Build update object with timestamp
    const updateData: Record<string, unknown> = { status };
    const now = new Date().toISOString();

    switch (status) {
      case "in_progress":
        updateData.started_at = now;
        break;
      case "ready":
        updateData.ready_at = now;
        break;
      case "bumped":
        updateData.bumped_at = now;
        break;
    }

    // Build query based on what was provided
    let query = supabase.from("kds_tickets").update(updateData);

    if (orderId) {
      query = query.eq("order_id", orderId);
    }
    if (stationId) {
      query = query.eq("station_id", stationId);
    }

    const { data: tickets, error } = await query.select();

    if (error) {
      logger.error("[KDS] Error bulk updating tickets:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // If bumping tickets, check if ALL tickets for this order are now bumped
    if (status === "bumped" && orderId) {
      // Check if all tickets for this order are bumped
      const { data: allOrderTickets } = await supabase
        .from("kds_tickets")
        .select("id, status")
        .eq("order_id", orderId);

      const allBumped = allOrderTickets?.every((t) => t.status === "bumped") || false;

      logger.debug("[KDS] Checking if all tickets bumped", {
        orderId,
        totalTickets: allOrderTickets?.length,
        bumpedTickets: allOrderTickets?.filter((t) => t.status === "bumped").length,
        allBumped,
      });

      // Only update order status if ALL tickets are bumped
      if (allBumped) {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("order_status")
          .eq("id", orderId)
          .single();

        logger.debug("[KDS] All tickets bumped - updating order status", {
          orderId,
          currentStatus: currentOrder?.order_status,
          updatingTo: "READY",
        });

        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({
            order_status: "READY",
            updated_at: now,
          })
          .eq("id", orderId);

        if (orderUpdateError) {
          logger.error("[KDS] Error updating order status after bump:", {
            error: orderUpdateError.message,
            orderId,
            currentStatus: currentOrder?.order_status,
          });
        } else {
          logger.info(
            "[KDS] Order status updated to READY - all items bumped, staff can mark as SERVED",
            {
              orderId,
              previousStatus: currentOrder?.order_status,
            }
          );
        }
      } else {
        logger.debug("[KDS] Not all tickets bumped yet - order status unchanged", {
          orderId,
          bumpedCount: allOrderTickets?.filter((t) => t.status === "bumped").length,
          totalCount: allOrderTickets?.length,
        });
      }

      // Clean up table session after bumping
      try {
        const { cleanupTableOnOrderCompletion } = await import("@/lib/table-cleanup");
        // Note: This function requires venueId, which we don't have here
        // Skip cleanup for now - will be handled by order completion handlers
      } catch (_error) {
        // Error handled silently
      }
    }

    return NextResponse.json({
      ok: true,
      updated: tickets?.length || 0,
      tickets,
    });
  } catch (_error) {
    logger.error("[KDS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { ok: false, error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}

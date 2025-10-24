import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// PATCH - Bulk update multiple tickets (e.g., bump all ready tickets for an order)
export async function PATCH(_req: Request) {
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

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.supabase) {
      return NextResponse.json({ ok: false, error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { supabase } = auth;

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

    // If bumping tickets, also update the main order status to SERVED
    if (status === "bumped" && orderId) {
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          order_status: "SERVED",
          updated_at: now,
        })
        .eq("id", orderId);

      if (orderUpdateError) {
        logger.error("[KDS] Error updating order status after bump:", {
          error: orderUpdateError.message,
        });
        // Don't fail the request, just log the error
      } else {
        logger.debug("[KDS] Updated order status to SERVED after bump", { orderId });
      }
    }

    return NextResponse.json({
      ok: true,
      updated: tickets?.length || 0,
      tickets,
    });
  } catch (error) {
    logger.error("[KDS] Unexpected error:", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

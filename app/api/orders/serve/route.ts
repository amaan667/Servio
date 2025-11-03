import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const startedAt = new Date().toISOString();

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Use admin client - no authentication required for customer-facing flow
    const admin = createAdminClient();

    // Get the order details
    const { data: orderData, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      logger.error("[ORDERS SERVE] Failed to fetch order", {
        error: { orderId, context: fetchError },
      });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!orderData) {
      logger.error("[ORDERS SERVE] Order not found", { orderId });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const currentStatus = (orderData.order_status || "").toString().toUpperCase();
    logger.debug("[ORDERS SERVE] Loaded order", {
      data: {
        orderId: orderData.id,
        venueId: orderData.venue_id,
        order_status: orderData.order_status,
        currentStatus,
      },
    });

    // Allow serving orders that are READY or SERVING
    // READY = kitchen marked as ready (from KDS bump), SERVING = already being served (re-serve case)
    // Note: Orders must be READY before serving (set by KDS when tickets are bumped)
    const allowedStatuses = ["READY", "SERVING"];
    if (!allowedStatuses.includes(currentStatus)) {
      logger.warn("[ORDERS SERVE] Refusing serve due to status", {
        orderId,
        currentStatus,
        orderData: {
          id: orderData.id,
          status: orderData.order_status,
          created_at: orderData.created_at,
        },
      });
      return NextResponse.json(
        {
          error: `Order must be READY (from KDS) or SERVING to mark as served. Current status: ${currentStatus}. Please ensure KDS has marked tickets as ready/bumped.`,
          currentStatus,
          orderId,
        },
        { status: 400 }
      );
    }

    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return NextResponse.json({ error: "Order missing venue_id" }, { status: 400 });
    }


    // Update the order status to SERVING (which is allowed by DB constraint)
    // SERVED may not be in the constraint, so use SERVING as intermediate status
    const { error } = await admin
      .from("orders")
      .update({
        order_status: "SERVING",
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venueId);

    if (error) {
      logger.error("[ORDERS SERVE] Failed to update order status", {
        error: { orderId, context: venueId, error },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update table_sessions if present (best-effort)
    try {
      await admin
        .from("table_sessions")
        .update({
          status: "SERVED",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq("venue_id", venueId);
      logger.debug("[ORDERS SERVE] table_sessions updated to SERVED", {
        data: { orderId, extra: venueId },
      });
    } catch (_e) {
      // best-effort; don't fail the request if this errors (RLS or not found)
      logger.warn("[ORDERS SERVE] table_sessions update warning", { orderId, venueId, error: _e });
    }

    logger.debug("[ORDERS SERVE] Order marked as served", {
      orderId,
      paymentStatus: orderData.payment_status,
      paymentMode: orderData.payment_mode,
    });

    return NextResponse.json({
      success: true,
      message: "Order marked as served",
      orderStatus: "SERVING",
      paymentStatus: orderData.payment_status,
      paymentMode: orderData.payment_mode,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[ORDERS SERVE][UNCAUGHT]", { error: { error: err.message, stack: err.stack } });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err.message,
      },
      { status: 500 }
    );
  }
}

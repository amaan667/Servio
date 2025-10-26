import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const startedAt = new Date().toISOString();
    logger.debug("[ORDERS SERVE][START]", { startedAt });

    const { orderId } = await req.json();
    logger.debug("[ORDERS SERVE] Incoming request body", { orderId });

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Use admin client - no authentication required for customer-facing flow
    const admin = createAdminClient();
    logger.debug("[ORDERS SERVE] Using admin client (no auth required)");

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
    logger.debug("[ORDERS SERVE] Loaded order", {
      data: {
        orderId: orderData.id,
        venueId: orderData.venue_id,
        order_status: orderData.order_status,
      },
    });

    // Only allow serving orders that are READY (case-insensitive)
    const currentStatus = (orderData.order_status || "").toString().toUpperCase();
    if (currentStatus !== "READY") {
      logger.warn("[ORDERS SERVE] Refusing serve due to status", { orderId, currentStatus });
      return NextResponse.json(
        {
          error: "Order must be READY to mark as SERVED",
        },
        { status: 400 }
      );
    }

    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return NextResponse.json({ error: "Order missing venue_id" }, { status: 400 });
    }

    logger.debug("[ORDERS SERVE] No auth required - customer-facing feature");

    // Update the order status to SERVING
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
    logger.debug("[ORDERS SERVE] Order updated to SERVING", { data: { orderId, extra: venueId } });

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

    return NextResponse.json({
      success: true,
      message: "Order marked as served",
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

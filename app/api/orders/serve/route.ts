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

    logger.debug("[ORDERS SERVE] No auth required - customer-facing feature");

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

    // Check if payment has been completed - if so, automatically complete the order
    const paymentStatus = (orderData.payment_status || "").toString().toUpperCase();
    logger.debug("[ORDERS SERVE] Checking payment status", {
      orderId,
      paymentStatus,
      paymentMode: orderData.payment_mode,
    });

    if (paymentStatus === "PAID") {
      logger.debug("[ORDERS SERVE] Payment completed - auto-completing order", { orderId });

      // Import the cleanup function
      const { cleanupTableOnOrderCompletion } = await import("@/lib/table-cleanup");

      // Update order to COMPLETED
      const { error: completeError } = await admin
        .from("orders")
        .update({
          order_status: "COMPLETED",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("venue_id", venueId);

      if (completeError) {
        logger.error("[ORDERS SERVE] Failed to auto-complete order", {
          error: { orderId, context: venueId, error: completeError },
        });
        // Don't fail the request - order is still marked as served
      } else {
        logger.debug("[ORDERS SERVE] Order auto-completed successfully", {
          data: { orderId, extra: venueId },
        });

        // Clear table session and runtime state if this is a table order
        if (orderData.table_id || orderData.table_number) {
          logger.debug("[ORDERS SERVE] Clearing table session for auto-completed order", {
            data: {
              orderId,
              tableId: orderData.table_id,
              tableNumber: orderData.table_number,
            },
          });

          const cleanupResult = await cleanupTableOnOrderCompletion({
            venueId,
            tableId: orderData.table_id || undefined,
            tableNumber: orderData.table_number?.toString() || undefined,
            orderId,
          });

          if (!cleanupResult.success) {
            logger.warn("[ORDERS SERVE] Table cleanup failed", {
              orderId,
              venueId,
              error: cleanupResult.error,
            });
          } else {
            logger.debug("[ORDERS SERVE] Table cleanup successful", {
              orderId,
              venueId,
              details: cleanupResult.details,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: "Order marked as served and automatically completed (payment received)",
          autoCompleted: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order marked as served",
      autoCompleted: false,
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

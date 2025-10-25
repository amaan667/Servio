import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const startedAt = new Date().toISOString();
    logger.debug("[ORDERS COMPLETE][START]", { startedAt });

    const { orderId } = await req.json();
    logger.debug("[ORDERS COMPLETE] Incoming request body", { orderId });

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Use admin client - no authentication required for customer-facing flow
    const admin = createAdminClient();
    logger.debug("[ORDERS COMPLETE] Using admin client (no auth required)");

    // Get the order details
    const { data: orderData, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      logger.error("[ORDERS COMPLETE] Failed to fetch order", {
        error: { orderId, context: fetchError },
      });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!orderData) {
      logger.error("[ORDERS COMPLETE] Order not found", { orderId });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    logger.debug("[ORDERS COMPLETE] Loaded order", {
      data: {
        orderId: orderData.id,
        venueId: orderData.venue_id,
        order_status: orderData.order_status,
      },
    });

    // Only allow completing orders that are SERVING (case-insensitive)
    const currentStatus = (orderData.order_status || "").toString().toUpperCase();
    if (currentStatus !== "SERVING") {
      logger.warn("[ORDERS COMPLETE] Refusing complete due to status", { orderId, currentStatus });
      return NextResponse.json(
        {
          error: "Order must be SERVING to mark as COMPLETED",
        },
        { status: 400 }
      );
    }

    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return NextResponse.json({ error: "Order missing venue_id" }, { status: 400 });
    }

    logger.debug("[ORDERS COMPLETE] No auth required - customer-facing feature");

    // Update the order status to COMPLETED
    const { error } = await admin
      .from("orders")
      .update({
        order_status: "COMPLETED",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venueId);

    if (error) {
      logger.error("[ORDERS COMPLETE] Failed to update order status", {
        error: { orderId, context: venueId, error },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    logger.debug("[ORDERS COMPLETE] Order updated to COMPLETED", {
      data: { orderId, extra: venueId },
    });

    // Clear table session for QR orders - free up the table
    if ((orderData.table_id || orderData.table_number) && orderData.source === "qr") {
      logger.debug("[ORDERS COMPLETE] Clearing table session for QR order", {
        data: { orderId, tableId: orderData.table_id, tableNumber: orderData.table_number },
      });

      try {
        // Close the table session
        const { error: sessionError } = await admin
          .from("table_sessions")
          .update({
            status: "FREE",
            order_id: null,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("venue_id", venueId);

        if (sessionError) {
          logger.warn("[ORDERS COMPLETE] Failed to clear table session", { error: sessionError });
        } else {
          logger.debug("[ORDERS COMPLETE] Table session cleared successfully");
        }
      } catch (sessionErr) {
        // Best-effort; don't fail the request if table cleanup fails
        logger.warn("[ORDERS COMPLETE] Table session cleanup error", {
          orderId,
          venueId,
          error: sessionErr,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order marked as completed and table freed",
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[ORDERS COMPLETE][UNCAUGHT]", {
      error: { error: err.message, stack: err.stack },
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err.message,
      },
      { status: 500 }
    );
  }
}

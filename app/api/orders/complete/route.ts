import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";

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

    // CRITICAL: Only allow completing orders that have been PAID
    const paymentStatus = (orderData.payment_status || "").toString().toUpperCase();
    if (paymentStatus !== "PAID") {
      logger.warn("[ORDERS COMPLETE] Refusing complete due to unpaid status", {
        orderId,
        paymentStatus,
        paymentMode: orderData.payment_mode,
      });
      return NextResponse.json(
        {
          error: "Payment must be collected before marking order as COMPLETED",
          payment_status: paymentStatus,
          payment_mode: orderData.payment_mode,
        },
        { status: 400 }
      );
    }

    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return NextResponse.json({ error: "Order missing venue_id" }, { status: 400 });
    }


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

    // Clear table session and runtime state for ALL orders with tables - free up the table
    if (orderData.table_id || orderData.table_number) {
      logger.debug("[ORDERS COMPLETE] Clearing table session and runtime state for order", {
        data: {
          orderId,
          tableId: orderData.table_id,
          tableNumber: orderData.table_number,
          paymentStatus: orderData.payment_status,
          source: orderData.source,
        },
      });

      // Use centralized cleanup function that handles both table_sessions and table_runtime_state
      const cleanupResult = await cleanupTableOnOrderCompletion({
        venueId,
        tableId: orderData.table_id || undefined,
        tableNumber: orderData.table_number?.toString() || undefined,
        orderId,
      });

      if (!cleanupResult.success) {
        logger.warn("[ORDERS COMPLETE] Table cleanup failed", {
          orderId,
          venueId,
          error: cleanupResult.error,
        });
      } else {
        logger.debug("[ORDERS COMPLETE] Table cleanup successful", {
          orderId,
          venueId,
          details: cleanupResult.details,
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

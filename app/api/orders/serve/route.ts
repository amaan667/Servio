import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";

export async function POST(req: Request) {
  try {
    const startedAt = new Date().toISOString();

    const { orderId } = await req.json();

    if (!orderId) {
      return apiErrors.badRequest("Order ID is required");
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
      return apiErrors.internal("Internal server error");
    }
    if (!orderData) {
      logger.error("[ORDERS SERVE] Order not found", { orderId });
      return apiErrors.notFound("Order not found");
    }
    const currentStatus = (orderData.order_status || "").toString().toUpperCase();
    const venueId = orderData.venue_id as string;
    if (!venueId) {
      return apiErrors.badRequest("Order missing venue_id");
    }

    logger.debug("[ORDERS SERVE] Loaded order", {
      data: {
        orderId: orderData.id,
        venueId: orderData.venue_id,
        order_status: orderData.order_status,
        currentStatus,
      },
    });

    // Check if order has KDS tickets
    const { data: kdsTickets, error: ticketsError } = await admin
      .from("kds_tickets")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("venue_id", venueId);

    if (ticketsError) {
      logger.warn("[ORDERS SERVE] Error checking KDS tickets, proceeding with status check", {
        orderId,
        error: ticketsError.message,
      });
    }

    const hasKdsTickets = kdsTickets && kdsTickets.length > 0;
    const allTicketsBumped = hasKdsTickets ? kdsTickets.every((t) => t.status === "bumped") : true; // If no tickets, consider as "all bumped"

    // Allow serving orders that are:
    // 1. READY or SERVING (normal flow with KDS)
    // 2. PLACED or IN_PREP if they have no KDS tickets OR all tickets are already bumped
    // This allows orders without KDS tickets to bypass the KDS workflow
    const allowedStatuses = ["READY", "SERVING"];
    const canServeWithoutKds = !hasKdsTickets || allTicketsBumped;
    const allowedStatusesWithKdsBypass = canServeWithoutKds
      ? ["READY", "SERVING", "PLACED", "IN_PREP"]
      : allowedStatuses;

    if (!allowedStatusesWithKdsBypass.includes(currentStatus)) {
      logger.warn("[ORDERS SERVE] Refusing serve due to status", {
        orderId,
        currentStatus,
        hasKdsTickets,
        allTicketsBumped,
        ticketCount: kdsTickets?.length || 0,
        orderData: {
          id: orderData.id,
          status: orderData.order_status,
          created_at: orderData.created_at,
        },
      });
      const errorMessage =
        hasKdsTickets && !allTicketsBumped
          ? `Order must be READY (from KDS) or SERVING to mark as served. Current status: ${currentStatus}. Please ensure KDS has marked all tickets as ready/bumped.`
          : `Order cannot be served in current status: ${currentStatus}. Order must be READY, SERVING, PLACED, or IN_PREP to mark as served.`;

      return NextResponse.json(
        {
          error: errorMessage,
          currentStatus,
          orderId,
          hasKdsTickets,
          allTicketsBumped,
        },
        { status: 400 }
      );
    }

    // Log if serving order without KDS tickets (bypassing KDS workflow)
    if (!hasKdsTickets) {
      logger.info("[ORDERS SERVE] Serving order without KDS tickets (bypassing KDS workflow)", {
        orderId,
        currentStatus,
        venueId,
      });
    } else if (allTicketsBumped && currentStatus !== "READY" && currentStatus !== "SERVING") {
      logger.info(
        "[ORDERS SERVE] Serving order with all tickets bumped but status not READY/SERVING",
        {
          orderId,
          currentStatus,
          venueId,
          ticketCount: kdsTickets.length,
        }
      );
    }

    // Update the order status to SERVED
    const { error } = await admin
      .from("orders")
      .update({
        order_status: "SERVED",
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", venueId);

    if (error) {
      logger.error("[ORDERS SERVE] Failed to update order status", {
        error: { orderId, context: venueId, error },
      });
      return apiErrors.internal(error.message || "Internal server error");
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
      orderStatus: "SERVED",
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

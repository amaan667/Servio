import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
export const runtime = "nodejs";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
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

      const { orderId } = await req.json();

      if (!orderId) {
        return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
      }

      // Use admin client
      const admin = createAdminClient();

    // Get the order details - verify it belongs to authenticated venue
    const { data: orderData, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("venue_id", context.venueId) // Security: ensure order belongs to authenticated venue
      .single();

    if (fetchError || !orderData) {
      logger.error("[ORDERS COMPLETE] Order not found or venue mismatch:", {
        orderId,
        venueId: context.venueId,
        error: fetchError,
      });
      return NextResponse.json(
        { error: "Order not found or access denied" },
        { status: 404 }
      );
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

    // Update the order status to COMPLETED
    const { error } = await admin
      .from("orders")
      .update({
        order_status: "COMPLETED",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("venue_id", context.venueId); // Security: ensure venue matches

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
        venueId: context.venueId,
        tableId: orderData.table_id || undefined,
        tableNumber: orderData.table_number?.toString() || undefined,
        orderId,
      });

      if (!cleanupResult.success) {
        logger.warn("[ORDERS COMPLETE] Table cleanup failed", {
          orderId,
          venueId: context.venueId,
          error: cleanupResult.error,
        });
      } else {
        logger.debug("[ORDERS COMPLETE] Table cleanup successful", {
          orderId,
          venueId: context.venueId,
          details: cleanupResult.details,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order marked as completed and table freed",
    });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[ORDERS COMPLETE] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
      });
      
      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Failed to complete order",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from order lookup
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        const orderId = body?.orderId;
        if (orderId) {
          const { createAdminClient } = await import("@/lib/supabase");
          const admin = createAdminClient();
          const { data: order } = await admin
            .from("orders")
            .select("venue_id")
            .eq("id", orderId)
            .single();
          if (order?.venue_id) {
            return order.venue_id;
          }
        }
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);

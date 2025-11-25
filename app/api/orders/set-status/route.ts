import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { apiLogger as logger } from "@/lib/logger";
import { validateOrderCompletion } from "@/lib/orders/payment-validation";
import { requireAuthForAPI } from "@/lib/auth/api";

export async function POST(req: Request) {
  try {
    // STANDARDIZED: Use requireAuthForAPI for consistent authentication
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }

    const { orderId, status } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: "Order ID and status are required" }, { status: 400 });
    }

    // Validate status
    const validStatuses = ["IN_PREP", "READY", "SERVING", "SERVED", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = await createClient();

    // First get the order details before updating
    const { data: orderData, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      logger.error("Failed to fetch order:", { value: fetchError });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // CRITICAL: Validate payment before allowing COMPLETED status
    if (status === "COMPLETED") {
      const validation = await validateOrderCompletion(supabase, orderId);
      if (!validation.isValid) {
        logger.warn("[SET STATUS] Payment validation failed", {
          orderId,
          error: validation.error,
          paymentStatus: validation.paymentStatus,
        });
        return NextResponse.json(
          {
            error: validation.error || "Cannot complete unpaid order",
            payment_status: validation.paymentStatus,
          },
          { status: 400 }
        );
      }
    }

    // Update the order status
    const { error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", orderId);

    if (error) {
      logger.error("Failed to set order status:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle table clearing when order is completed or cancelled
    if (status === "COMPLETED" || status === "CANCELLED") {
      const order = orderData;
      if (order && (order.table_id || order.table_number)) {
        // Use centralized table cleanup function
        const cleanupResult = await cleanupTableOnOrderCompletion({
          venueId: order.venue_id,
          tableId: order.table_id,
          tableNumber: order.table_number,
          orderId: orderId,
        });

        if (!cleanupResult.success) {
          logger.error("[SET STATUS] Table cleanup failed:", cleanupResult.error);
        } else {

          // Block handled

        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("Set status error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Unknown _error" },
      { status: 500 }
    );
  }
}

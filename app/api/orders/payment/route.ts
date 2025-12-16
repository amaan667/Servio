import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors } from "@/lib/api/standard-response";
import { isDevelopment } from "@/lib/env";

/**
 * Payment API Route - No authentication required for ordering UI
 * This allows customers and staff to process payments without auth checks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, venue_id, payment_method, payment_status } = body;

    if (!orderId || !venue_id) {
      return apiErrors.badRequest("Order ID and venue ID are required");
    }

    // Use admin client - no auth required for payment processing
    const supabase = createAdminClient();

    // Verify order exists and belongs to venue
    // Allow updating payment status for any order (including completed ones) - staff may need to mark old orders as paid
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("venue_id, payment_status, order_status")
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    if (checkError || !orderCheck) {
      logger.error("[ORDERS PAYMENT] Order not found", {
        error: checkError?.message,
        orderId,
        venue_id,
      });
      return apiErrors.notFound("Order not found");
    }

    // Update payment status - allow for any order status (staff may need to mark completed orders as paid)
    const updateData: Record<string, unknown> = {
      payment_status: payment_status || "PAID",
      updated_at: new Date().toISOString(),
    };

    if (payment_method) {
      updateData.payment_method = payment_method.toUpperCase();
      // If payment method is "till", set payment_mode to "pay_at_till"
      if (payment_method.toLowerCase() === "till") {
        updateData.payment_mode = "pay_at_till";
      }
    }

    // Update payment status - no restrictions on order_status or completion_status
    // This allows staff to mark any order as paid, even if it's from a previous day or already completed
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select()
      .single();

    if (updateError) {
      logger.error("[ORDERS PAYMENT] Failed to update payment", {
        error: updateError?.message,
        errorCode: updateError?.code,
        errorDetails: updateError?.details,
        orderId,
        venue_id,
        updateData,
        currentOrderStatus: orderCheck.order_status,
        currentPaymentStatus: orderCheck.payment_status,
      });
      
      // Provide more specific error message
      if (updateError.code === "PGRST116") {
        return apiErrors.notFound("Order not found or access denied");
      }
      if (updateError.code === "23505") {
        return apiErrors.badRequest("Payment status update conflict - order may have been modified");
      }
      
      return apiErrors.internal(
        `Failed to update payment status: ${updateError.message || "Unknown error"}`,
        isDevelopment() ? updateError : undefined
      );
    }

    if (!updatedOrder) {
      logger.error("[ORDERS PAYMENT] Update succeeded but no order returned", {
        orderId,
        venue_id,
      });
      return apiErrors.internal("Payment update succeeded but order data not returned");
    }

    logger.info("[ORDERS PAYMENT] Payment updated successfully", {
      orderId,
      payment_status: updateData.payment_status,
      payment_method: updateData.payment_method,
      venue_id,
    });

    return success({ order: updatedOrder });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[ORDERS PAYMENT] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal("Internal server error");
  }
}

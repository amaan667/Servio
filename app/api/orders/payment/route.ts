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

    // Get current order to check existing payment_method
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("payment_method, payment_mode")
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    // Update payment status - allow for any order status (staff may need to mark completed orders as paid)
    const updateData: Record<string, unknown> = {
      payment_status: payment_status || "PAID",
      updated_at: new Date().toISOString(),
    };

    // Determine payment_method and payment_mode
    let finalPaymentMethod: string | undefined;
    let finalPaymentMode: string | undefined;

    if (payment_method) {
      finalPaymentMethod = payment_method.toUpperCase();
    } else if (currentOrder?.payment_method) {
      // Use existing payment_method if not provided
      finalPaymentMethod = currentOrder.payment_method.toUpperCase();
    } else {
      // Default to PAY_AT_TILL if no payment method specified (staff marking as paid)
      finalPaymentMethod = "PAY_AT_TILL";
    }

    // Set payment_mode based on payment_method to satisfy constraint
    if (finalPaymentMethod === "PAY_NOW") {
      finalPaymentMode = "online";
    } else if (finalPaymentMethod === "PAY_LATER") {
      // PAY_LATER can be online or deferred, prefer existing mode or default to online
      finalPaymentMode = currentOrder?.payment_mode?.toLowerCase() || "online";
      if (finalPaymentMode !== "online" && finalPaymentMode !== "deferred") {
        finalPaymentMode = "online";
      }
    } else if (finalPaymentMethod === "PAY_AT_TILL") {
      finalPaymentMode = "offline";
    }

    // Always set both to ensure constraint is satisfied
    if (finalPaymentMethod) {
      updateData.payment_method = finalPaymentMethod;
    }
    if (finalPaymentMode) {
      updateData.payment_mode = finalPaymentMode;
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

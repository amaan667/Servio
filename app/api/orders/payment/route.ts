import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors } from '@/lib/api/standard-response';

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
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("venue_id, payment_status")
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

    // Update payment status
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

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      logger.error("[ORDERS PAYMENT] Failed to update payment", {
        error: updateError?.message,
        orderId,
        venue_id,
      });
      return apiErrors.internal("Failed to update payment status");
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


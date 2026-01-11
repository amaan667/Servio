import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

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

      return apiErrors.notFound("Order not found");
    }

    // Get current order to check existing payment_method and payment_mode
    const { data: currentOrder, error: currentOrderError } = await supabase
      .from("orders")
      .select("payment_method, payment_mode")
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    if (currentOrderError) { /* Condition handled */ }

    // Update payment status - allow for any order status (staff may need to mark completed orders as paid)
    const updateData: Record<string, unknown> = {
      payment_status: payment_status || "PAID",
      updated_at: new Date().toISOString(),
    };

    // Determine payment_method and payment_mode
    let finalPaymentMethod: string;
    let finalPaymentMode: string;

    // Normalize provided payment_method
    const normalizedProvidedMethod = payment_method
      ? payment_method.toUpperCase().replace(/[^A-Z_]/g, "")
      : null;

    // Handle "till" or "PAY_AT_TILL" variations
    if (normalizedProvidedMethod === "TILL" || normalizedProvidedMethod === "PAY_AT_TILL") {
      finalPaymentMethod = "PAY_AT_TILL";
      finalPaymentMode = "offline";
    } else if (normalizedProvidedMethod) {
      // Use provided method
      finalPaymentMethod = normalizedProvidedMethod;
      // Set payment_mode based on payment_method
      if (finalPaymentMethod === "PAY_NOW") {
        finalPaymentMode = "online";
      } else if (finalPaymentMethod === "PAY_LATER") {
        // PAY_LATER can be online or deferred, prefer existing mode or default to online
        const existingMode = currentOrder?.payment_mode?.toLowerCase();
        if (existingMode === "online" || existingMode === "deferred") {
          finalPaymentMode = existingMode;
        } else {
          finalPaymentMode = "online";
        }
      } else if (finalPaymentMethod === "PAY_AT_TILL") {
        finalPaymentMode = "offline";
      } else {
        // Fallback: if payment_method doesn't match known values, default to PAY_AT_TILL

        finalPaymentMethod = "PAY_AT_TILL";
        finalPaymentMode = "offline";
      }
    } else if (currentOrder?.payment_method) {
      // Use existing payment_method if not provided
      finalPaymentMethod = String(currentOrder.payment_method).toUpperCase();
      // Set payment_mode based on existing payment_method
      if (finalPaymentMethod === "PAY_NOW") {
        finalPaymentMode = "online";
      } else if (finalPaymentMethod === "PAY_LATER") {
        // PAY_LATER can be online or deferred, prefer existing mode or default to online
        const existingMode = currentOrder?.payment_mode?.toLowerCase();
        if (existingMode === "online" || existingMode === "deferred") {
          finalPaymentMode = existingMode;
        } else {
          finalPaymentMode = "online";
        }
      } else if (finalPaymentMethod === "PAY_AT_TILL") {
        finalPaymentMode = "offline";
      } else {
        // Fallback: if payment_method doesn't match known values, default to PAY_AT_TILL

        finalPaymentMethod = "PAY_AT_TILL";
        finalPaymentMode = "offline";
      }
    } else {
      // Default to PAY_AT_TILL if no payment method specified (staff marking as paid)
      finalPaymentMethod = "PAY_AT_TILL";
      finalPaymentMode = "offline";
    }

    // Always set both to ensure constraint is satisfied
    updateData.payment_method = finalPaymentMethod;
    updateData.payment_mode = finalPaymentMode;

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

      // Provide more specific error message
      if (updateError.code === "PGRST116") {
        return apiErrors.notFound("Order not found or access denied");
      }
      if (updateError.code === "23505") {
        return apiErrors.badRequest(
          "Payment status update conflict - order may have been modified"
        );
      }

      return apiErrors.internal(
        `Failed to update payment status: ${updateError.message || "Unknown error"}`,
        isDevelopment() ? updateError : undefined
      );
    }

    if (!updatedOrder) {

      return apiErrors.internal("Payment update succeeded but order data not returned");
    }

    return success({ order: updatedOrder });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return apiErrors.internal("Internal server error");
  }
}

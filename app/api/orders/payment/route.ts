import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { success, apiErrors } from "@/lib/api/standard-response";
import { isDevelopment } from "@/lib/env";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  normalizePaymentStatus,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";

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
      .select(
        "venue_id, payment_status, order_status, payment_method, payment_mode, qr_type, fulfillment_type, source, requires_collection"
      )
      .eq("id", orderId)
      .eq("venue_id", venue_id)
      .single();

    if (checkError || !orderCheck) {

      return apiErrors.notFound("Order not found");
    }

    const { data: venueSettings } = await supabase
      .from("venues")
      .select("allow_pay_at_till_for_table_collection")
      .eq("venue_id", venue_id)
      .maybeSingle();

    const allowPayAtTillForTableCollection =
      venueSettings?.allow_pay_at_till_for_table_collection === true;

    const normalizedProvidedMethod = normalizePaymentMethod(payment_method);
    const existingMethod = normalizePaymentMethod(orderCheck?.payment_method);
    const finalPaymentMethod = normalizedProvidedMethod || existingMethod || "PAY_NOW";

    const qrType = deriveQrTypeFromOrder(orderCheck || {});
    const validation = validatePaymentMethodForQrType({
      qrType,
      paymentMethod: finalPaymentMethod,
      allowPayAtTillForTableCollection,
    });

    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const normalizedStatus = normalizePaymentStatus(payment_status || null);
    if (normalizedStatus === "PAID" && finalPaymentMethod !== "PAY_NOW") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment confirmation for Pay at Till and Pay Later is staff-only.",
        },
        { status: 400 }
      );
    }

    // Update payment status - public endpoint only supports UNPAID for deferred/till flows
    const updateData: Record<string, unknown> = {
      payment_status: normalizedStatus || "UNPAID",
      updated_at: new Date().toISOString(),
      payment_method: finalPaymentMethod,
      payment_mode:
        finalPaymentMethod === "PAY_NOW"
          ? "online"
          : finalPaymentMethod === "PAY_LATER"
            ? "deferred"
            : "offline",
    };

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

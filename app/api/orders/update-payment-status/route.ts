import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { success, apiErrors } from "@/lib/api/standard-response";
import { normalizePaymentMethod, normalizePaymentStatus } from "@/lib/orders/qr-payment-validation";

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentStatus, paymentMethod } = await req.json();

    if (!orderId || !paymentStatus) {
      return apiErrors.badRequest("Order ID and payment status are required");
    }

    const supabase = await createClient();

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);

    if (normalizedPaymentStatus === "PAID" && normalizedPaymentMethod === "PAY_AT_TILL") {
      return apiErrors.badRequest("Pay at Till confirmation must be done by staff.");
    }

    if (normalizedPaymentStatus === "PAID" && normalizedPaymentMethod === "PAY_LATER") {
      return apiErrors.badRequest("Pay Later confirmation must be done by staff.");
    }

    // Convert to uppercase for database consistency
    const updateData: Record<string, unknown> = {
      payment_status: (normalizedPaymentStatus || "UNPAID").toUpperCase(),
      updated_at: new Date().toISOString(),
    };

    if (normalizedPaymentMethod) {
      updateData.payment_method = normalizedPaymentMethod;
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {

      return apiErrors.internal(error.message || "Internal server error");
    }

    return success({ data });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";

    return apiErrors.internal(errorMessage);
  }
}

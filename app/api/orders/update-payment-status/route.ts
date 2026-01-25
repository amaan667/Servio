import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { success, apiErrors } from "@/lib/api/standard-response";
import { normalizePaymentMethod, normalizePaymentStatus } from "@/lib/orders/qr-payment-validation";
import { getRequestMetadata, getIdempotencyKey } from "@/lib/api/request-helpers";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";

export async function POST(req: NextRequest) {
  const requestMetadata = getRequestMetadata(req);
  const requestId = requestMetadata.correlationId;
  
  try {
    const body = await req.json();
    const { orderId, paymentStatus, paymentMethod } = body;

    // Optional idempotency check (non-breaking - only if header is provided)
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const existing = await checkIdempotency(idempotencyKey);
      if (existing.exists) {
        return success(
          existing.response.response_data as { data: unknown },
          { timestamp: new Date().toISOString(), requestId },
          requestId
        );
      }
    }

    if (!orderId || !paymentStatus) {
      return apiErrors.badRequest("Order ID and payment status are required", undefined, requestId);
    }

    const supabase = await createClient();

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);

    if (normalizedPaymentStatus === "PAID" && normalizedPaymentMethod === "PAY_AT_TILL") {
      return apiErrors.badRequest("Pay at Till confirmation must be done by staff.", undefined, requestId);
    }

    if (normalizedPaymentStatus === "PAID" && normalizedPaymentMethod === "PAY_LATER") {
      return apiErrors.badRequest("Pay Later confirmation must be done by staff.", undefined, requestId);
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

      return apiErrors.internal(error.message || "Internal server error", undefined, requestId);
    }

    const response = { data };

    // Store idempotency key if provided (non-breaking - only if header was sent)
    if (idempotencyKey) {
      const requestHash = JSON.stringify(body);
      await storeIdempotency(
        idempotencyKey,
        requestHash,
        response,
        200,
        3600 // 1 hour TTL
      ).catch(() => {
        // Don't fail request if idempotency storage fails
      });
    }

    return success(response, { timestamp: new Date().toISOString(), requestId }, requestId);
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";

    return apiErrors.internal(errorMessage, undefined, requestId);
  }
}

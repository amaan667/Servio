import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors } from "@/lib/api/standard-response";

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentStatus, paymentMethod } = await req.json();

    if (!orderId || !paymentStatus) {
      return apiErrors.badRequest("Order ID and payment status are required");
    }

    const supabase = await createClient();

    // Convert to uppercase for database consistency
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus.toUpperCase(),
      updated_at: new Date().toISOString(),
    };

    if (paymentMethod) {
      updateData.payment_method = paymentMethod.toUpperCase();
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      logger.error("[UPDATE PAYMENT STATUS] Failed to update payment status", {
        error: error.message,
      });
      return apiErrors.internal(error.message || "Internal server error");
    }

    return success({ data });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[UPDATE PAYMENT STATUS] Error", {
      error: errorMessage,
    });
    return apiErrors.internal(errorMessage);
  }
}

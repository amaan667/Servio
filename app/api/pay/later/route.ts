import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      const body = await req.json();

    const { order_id, venue_id, sessionId } = body;

    logger.info("[PAY LATER] Pay later requested", {
      orderId: order_id,
      sessionId,
      venueId: venue_id,
      timestamp: new Date().toISOString(),
    });

    if (!order_id) {
      logger.error("[PAY LATER] Missing order ID in request body");
      return apiErrors.badRequest("Order ID is required");
    }

    if (!venue_id) {
      return apiErrors.badRequest("Venue ID is required");
    }

    // Create Supabase admin client (bypasses RLS - order was created with admin client)
    const supabase = createAdminClient();

    // Verify order belongs to venue (security check)
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", order_id)
      .eq("venue_id", venue_id) // Security: ensure order belongs to venue
      .single();

    if (checkError || !orderCheck) {
      logger.error("[PAY LATER] Order not found or venue mismatch", {
        orderId: order_id,
        venueId: venue_id,
        error: checkError,
      });
      return apiErrors.notFound("Order not found or access denied");
    }

    // Step 3: Attempt to update order
    // IMPORTANT: payment_status should remain "UNPAID", only payment_mode changes to "deferred"
    const updateData = {
      payment_mode: "deferred", // Standardized payment mode for Pay Later
      payment_status: "UNPAID", // Keep as UNPAID (not PAY_LATER)
      payment_method: "PAY_LATER", // Standardized payment method
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .eq("venue_id", venue_id) // Security: ensure venue matches
      .select()
      .single();

    if (updateError || !order) {
      logger.error("[PAY LATER] Failed to update order", {
        orderId: order_id,
        error: updateError,
      });
      return apiErrors.internal(
        "Failed to process order",
        updateError?.message || "Unknown error"
      );
    }

    logger.info("[PAY LATER] Order marked as pay later successfully", {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
      note: "Customer can re-scan QR to pay online",
    });

    return success({
      order_number: order.order_number,
      order_id: order.id,
      payment_status: "UNPAID",
      payment_mode: "deferred", // Standardized payment mode
      payment_method: "PAY_LATER", // Standardized payment method
      total_amount: order.total_amount,
    });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[PAY LATER] 💥 EXCEPTION CAUGHT:", {
        error: errorMessage,
        stack: errorStack,
      });

      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized")) {
        return apiErrors.unauthorized(errorMessage);
      }
      if (errorMessage.includes("Forbidden")) {
        return apiErrors.forbidden(errorMessage);
      }
      
      return apiErrors.internal(
        isDevelopment() ? errorMessage : "Payment processing failed",
        isDevelopment() && errorStack ? { stack: errorStack } : undefined
      );
    }
}

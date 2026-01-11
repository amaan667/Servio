import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    const body = await req.json();

    const { order_id, venue_id } = body;

    .toISOString(),

    if (!order_id) {
      
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
      
      return apiErrors.notFound("Order not found or access denied");
    }

    // Step 3: Attempt to update order
    // Keep payment_status as UNPAID so order shows in Payments page for staff to mark as paid
    const updateData = {
      payment_status: "UNPAID", // Keep as UNPAID so it shows in Payments page
      payment_mode: "offline", // Standardized payment mode for Pay at Till
      payment_method: "PAY_AT_TILL", // Standardized payment method

    };

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .eq("venue_id", venue_id) // Security: ensure venue matches
      .select()
      .single();

    if (updateError || !order) {
      
      return apiErrors.internal("Failed to process order", updateError?.message || "Unknown error");
    }

    

    return success({

      payment_status: "UNPAID", // Keep as UNPAID so it shows in Payments page
      payment_mode: "offline", // Standardized payment mode
      payment_method: "PAY_AT_TILL", // Standardized payment method

  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
    const errorStack = _error instanceof Error ? _error.stack : undefined;

    

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

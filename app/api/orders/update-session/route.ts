import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { orderId, sessionId, venueId } = await req.json();

    if (!orderId || !sessionId || !venueId) {
      return apiErrors.badRequest("orderId, sessionId, and venueId are required");
    }

    const supabase = await createClient();

    // Find the most recent UNPAID order for this venue that matches the criteria
    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .eq("payment_status", "UNPAID")
      .eq("payment_method", "stripe")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !order) {
      logger.error("[UPDATE SESSION] Order not found", {
        error: findError?.message,
        venueId,
        orderId,
      });
      return apiErrors.notFound("Order not found");
    }

    // Update the order with the session ID
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        stripe_session_id: sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      logger.error("[UPDATE SESSION] Error updating order", {
        error: updateError.message,
        orderId: order.id,
      });
      return apiErrors.database("Failed to update order");
    }

    return success({ orderId: order.id });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[UPDATE SESSION] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal("Internal server error");
  }
}

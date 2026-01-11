import { createClient } from "@/lib/supabase";
import { success, apiErrors } from "@/lib/api/standard-response";

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
      
      return apiErrors.notFound("Order not found");
    }

    // Update the order with the session ID
    const { error: updateError } = await supabase
      .from("orders")
      .update({

      .eq("id", order.id);

    if (updateError) {
      
      return apiErrors.database("Failed to update order");
    }

    return success({ orderId: order.id });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    
    return apiErrors.internal("Internal server error");
  }
}

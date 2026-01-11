import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

/**
 * POST /api/orders/close-table-session
 * Closes table session when order is completed/served
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return apiErrors.badRequest("orderId is required");
    }

    const supabase = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("venue_id, table_id, table_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return apiErrors.notFound("Order not found");
    }

    

    // Close any active table sessions for this table
    if (order.table_id) {
      const { error: sessionCloseError } = await supabase
        .from("table_sessions")
        .update({

        .eq("venue_id", order.venue_id)
        .eq("table_id", order.table_id)
        .is("closed_at", null);

      if (sessionCloseError) {
        
      } else {
        // Session closed successfully
      }
    }

    // Update table runtime state to FREE
    if (order.table_number) {
      const { error: runtimeError } = await supabase
        .from("table_runtime_state")
        .update({

        .eq("venue_id", order.venue_id)
        .eq("table_number", order.table_number);

      if (runtimeError) {
        
      } else {
        // Runtime state updated successfully
      }
    }

    return NextResponse.json({

  } catch (_error) {
     }
    );
    return apiErrors.internal("Internal server error");
  }
}

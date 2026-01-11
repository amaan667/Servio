import { createClient } from "@/lib/supabase";
import {
  OrdersMarkServedParams,
  OrdersCompleteParams,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
} from "@/types/ai-assistant";

export async function executeOrdersMarkServed(

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, table_id, tables(table_number)")
    .eq("id", params.orderId)
    .eq("venue_id", venueId)
    .single();

  if (!order) {
    throw new AIAssistantError("Order not found", "INVALID_PARAMS");
  }

  if (order.status !== "ready") {
    throw new AIAssistantError(
      `Order must be in 'ready' status to mark as served (current: ${order.status})`,
      "INVALID_PARAMS"
    );
  }

  const table = order.tables && (Array.isArray(order.tables) ? order.tables[0] : order.tables);

  if (preview) {
    return {

      before: { status: order.status },
      after: { status: "served" },

        description: `Order will be marked as served${table ? ` for table ${table.table_number}` : ""}`,
      },
    };
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({

    .eq("id", params.orderId);

  if (orderError) {
    throw new AIAssistantError("Failed to mark order as served", "EXECUTION_FAILED", {

  }

  return {

    result: { orderId: params.orderId },

  };
}

export async function executeOrdersComplete(

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total_amount")
    .eq("id", params.orderId)
    .eq("venue_id", venueId)
    .single();

  if (!order) {
    throw new AIAssistantError("Order not found", "INVALID_PARAMS");
  }

  if (order.status === "completed") {
    throw new AIAssistantError("Order is already completed", "INVALID_PARAMS");
  }

  if (preview) {
    return {

      before: { status: order.status },
      after: { status: "completed" },

        description: `Order will be completed. Revenue: £${order.total_amount.toFixed(2)}`,
      },
    };
  }

  const { error } = await supabase
    .from("orders")
    .update({

    .eq("id", params.orderId);

  if (error) {
    throw new AIAssistantError("Failed to complete order", "EXECUTION_FAILED", { error });
  }

  return {

    result: { orderId: params.orderId, revenue: order.total_amount },

  };
}

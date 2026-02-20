import { createClient } from "@/lib/supabase";
import {
  OrdersMarkServedParams,
  OrdersCompleteParams,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
} from "@/types/ai-assistant";

export async function executeOrdersMarkServed(
  params: OrdersMarkServedParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, table_id, tables(table_number)")
    .eq("id", params.orderId)
    .eq("venue_id", venueId)
    .single();

  if (!order) {
    throw new AIAssistantError("Order not found", "INVALID_PARAMS");
  }

  if (order.order_status !== "READY") {
    throw new AIAssistantError(
      `Order must be in 'READY' status to mark as served (current: ${order.order_status})`,
      "INVALID_PARAMS"
    );
  }

  const table = order.tables && (Array.isArray(order.tables) ? order.tables[0] : order.tables);

  if (preview) {
    return {
      toolName: "orders.mark_served",
      before: { status: order.order_status },
      after: { status: "SERVED" },
      impact: {
        itemsAffected: 1,
        description: `Order will be marked as served${table ? ` for table ${table.table_number}` : ""}`,
      },
    };
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      order_status: "SERVED",
      served_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId);

  if (orderError) {
    throw new AIAssistantError("Failed to mark order as served", "EXECUTION_FAILED", {
      error: orderError,
    });
  }

  return {
    success: true,
    toolName: "orders.mark_served",
    result: { orderId: params.orderId },
    auditId: "",
  };
}

export async function executeOrdersComplete(
  params: OrdersCompleteParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, total_amount")
    .eq("id", params.orderId)
    .eq("venue_id", venueId)
    .single();

  if (!order) {
    throw new AIAssistantError("Order not found", "INVALID_PARAMS");
  }

  if (order.order_status === "COMPLETED") {
    throw new AIAssistantError("Order is already completed", "INVALID_PARAMS");
  }

  if (preview) {
    return {
      toolName: "orders.complete",
      before: { status: order.order_status },
      after: { status: "COMPLETED" },
      impact: {
        itemsAffected: 1,
        estimatedRevenue: order.total_amount,
        description: `Order will be completed. Revenue: £${order.total_amount.toFixed(2)}`,
      },
    };
  }

  const { error } = await supabase
    .from("orders")
    .update({
      order_status: "COMPLETED",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId);

  if (error) {
    throw new AIAssistantError("Failed to complete order", "EXECUTION_FAILED", { error });
  }

  return {
    success: true,
    toolName: "orders.complete",
    result: { orderId: params.orderId, revenue: order.total_amount },
    auditId: "",
  };
}

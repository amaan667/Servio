// Servio AI Assistant - Order Management Tools
// Order status updates, kitchen queries, overdue tracking

import { createAdminClient } from "@/lib/supabase";

interface OrderStatusUpdateResult {

}

interface KitchenOrdersResult {

  }>;

}

interface OverdueOrdersResult {

  }>;

}

interface PendingOrdersResult {

  }>;

}

/**
 * Update order status
 */
export async function updateOrderStatus(

    "ACCEPTED",
    "IN_PREP",
    "READY",
    "SERVING",
    "COMPLETED",
    "CANCELLED",
  ];

  if (!validStatuses.includes(newStatus.toUpperCase())) {
    throw new Error(`Invalid status "${newStatus}". Valid statuses: ${validStatuses.join(", ")}`);
  }

  // Get current order
  const { data: currentOrder, error: fetchError } = await supabase
    .from("orders")
    .select("id, order_status, customer_name")
    .eq("id", orderId)
    .eq("venue_id", venueId)
    .single();

  if (fetchError || !currentOrder) {
    
    throw new Error(`Order ${orderId} not found`);
  }

  const oldStatus = currentOrder.order_status;

  // Update the order
  const updateData: Record<string, unknown> = {

  };

  // Add timestamps for specific status changes
  if (newStatus.toUpperCase() === "ACCEPTED") {
    updateData.accepted_at = new Date().toISOString();
  } else if (newStatus.toUpperCase() === "READY") {
    updateData.ready_at = new Date().toISOString();
  } else if (newStatus.toUpperCase() === "COMPLETED") {
    updateData.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .eq("venue_id", venueId);

  if (updateError) {
    
    throw new Error(`Failed to update order: ${updateError.message}`);
  }

  return {

    orderId,
    oldStatus,

    message: `Order ${orderId} updated from ${oldStatus} to ${newStatus.toUpperCase()}`,
  };
}

/**
 * Get orders currently in kitchen (IN_PREP status)
 */
export async function getKitchenOrders(venueId: string): Promise<KitchenOrdersResult> {
  const supabase = createAdminClient();

  

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, customer_name, table_number, counter_label, items, order_status, created_at")
    .eq("venue_id", venueId)
    .in("order_status", ["IN_PREP", "ACCEPTED", "READY"])
    .order("created_at", { ascending: true });

  if (error) {
    
    throw new Error(`Failed to fetch kitchen orders: ${error.message}`);
  }

  const kitchenOrders =
    orders?.map((order) => {
      const items = (order.items || []) as Array<{ item_name: string; quantity: number }>;
      const itemNames = items.map((item) => `${item.quantity}x ${item.item_name}`);
      const timeSinceOrder = Math.floor(
        (Date.now() - new Date(order.created_at).getTime()) / 60000
      );

      return {

        timeSinceOrder,
      };
    }) || [];

  return {

        ? `${kitchenOrders.length} orders currently in kitchen. Oldest order: ${kitchenOrders[0]?.timeSinceOrder} minutes ago.`

  };
}

/**
 * Get overdue orders (taking longer than expected)
 */
export async function getOverdueOrders(

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, customer_name, table_number, counter_label, items, order_status, created_at")
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP"])
    .lt("created_at", thresholdTime)
    .order("created_at", { ascending: true });

  if (error) {
    
    throw new Error(`Failed to fetch overdue orders: ${error.message}`);
  }

  const overdueOrders =
    orders?.map((order) => {
      const items = (order.items || []) as Array<{ item_name: string; quantity: number }>;
      const itemNames = items.map((item) => `${item.quantity}x ${item.item_name}`);
      const minutesOverdue = Math.floor(
        (Date.now() - new Date(order.created_at).getTime()) / 60000
      );

      return {

        minutesOverdue,

      };
    }) || [];

  return {

        ? `⚠️ ${overdueOrders.length} overdue orders! Oldest: ${overdueOrders[0]?.minutesOverdue} minutes. Action needed!`
        : `✅ No overdue orders. All orders being processed within ${thresholdMinutes} minutes.`,
  };
}

/**
 * Get all pending/active orders
 */
export async function getPendingOrders(venueId: string): Promise<PendingOrdersResult> {
  const supabase = createAdminClient();

  

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, customer_name, table_number, counter_label, total_amount, order_status, created_at"
    )
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
    .order("created_at", { ascending: false });

  if (error) {
    
    throw new Error(`Failed to fetch pending orders: ${error.message}`);
  }

  const pendingOrders =
    orders?.map((order) => ({

    })) || [];

  const totalValue = pendingOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  return {

    totalValue,

        ? `${pendingOrders.length} pending orders worth £${totalValue.toFixed(2)} total.`

  };
}

/**
 * Get today's order total and count
 */
export async function getTodayOrderStats(venueId: string): Promise<{

}> {
  const supabase = createAdminClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total_amount, order_status")
    .eq("venue_id", venueId)
    .gte("created_at", startOfDay.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  if (error) {
    
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  const count = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const avgOrderValue = count > 0 ? totalRevenue / count : 0;

  return {
    count,
    totalRevenue,
    avgOrderValue,
    message: `Today: ${count} orders, £${totalRevenue.toFixed(2)} revenue, £${avgOrderValue.toFixed(2)} avg order value.`,
  };
}

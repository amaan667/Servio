// Servio AI Assistant - Extended Order Management Executors

import { AIExecutionResult, AIPreviewDiff } from "@/types/ai-assistant";
import {
  updateOrderStatus,
  getKitchenOrders,
  getOverdueOrders,
  getPendingOrders,
  getTodayOrderStats,
} from "../tools/order-management-tools";

/**
 * Execute order status update
 */
export async function executeOrderUpdateStatus(
  params: { orderId: string; newStatus: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "orders.update_status",
      before: [{ orderId: params.orderId, status: "unknown" }],
      after: [{ orderId: params.orderId, status: params.newStatus }],
      impact: {
        itemsAffected: 1,
        description: `Will update order ${params.orderId} to ${params.newStatus}`,
      },
    };
  }

  const result = await updateOrderStatus(venueId, params.orderId, params.newStatus);

  return {
    success: true,
    toolName: "orders.update_status",
    result: {
      orderId: result.orderId,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute kitchen orders query
 */
export async function executeOrdersGetKitchen(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getKitchenOrders(venueId);

  return {
    success: true,
    toolName: "orders.get_kitchen",
    result: {
      orders: result.orders,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute overdue orders query
 */
export async function executeOrdersGetOverdue(
  params: { thresholdMinutes?: number },
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getOverdueOrders(venueId, params.thresholdMinutes);

  return {
    success: true,
    toolName: "orders.get_overdue",
    result: {
      orders: result.orders,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute pending orders query
 */
export async function executeOrdersGetPending(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getPendingOrders(venueId);

  return {
    success: true,
    toolName: "orders.get_pending",
    result: {
      orders: result.orders,
      count: result.count,
      totalValue: result.totalValue,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute today's order stats query
 */
export async function executeOrdersGetTodayStats(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getTodayOrderStats(venueId);

  return {
    success: true,
    toolName: "orders.get_today_stats",
    result: {
      count: result.count,
      totalRevenue: result.totalRevenue,
      avgOrderValue: result.avgOrderValue,
      message: result.message,
    },
    auditId: "",
  };
}

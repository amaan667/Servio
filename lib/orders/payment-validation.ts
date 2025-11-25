/**
 * Payment Validation Utilities
 * Ensures orders can only be completed if they are paid
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface PaymentValidationResult {
  isValid: boolean;
  error?: string;
  paymentStatus?: string;
  orderStatus?: string;
}

/**
 * Validate that an order can be completed (must be PAID)
 */
export async function validateOrderCompletion(
  supabase: SupabaseClient,
  orderId: string
): Promise<PaymentValidationResult> {
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("payment_status, order_status")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      logger.error("[PAYMENT VALIDATION] Order not found", {
        orderId,
        error: error?.message,
      });
      return {
        isValid: false,
        error: "Order not found",
      };
    }

    const paymentStatus = (order.payment_status || "").toString().toUpperCase();
    const orderStatus = (order.order_status || "").toString().toUpperCase();

    // CRITICAL: Order must be PAID before completion
    if (paymentStatus !== "PAID") {
      return {
        isValid: false,
        error: `Cannot complete order: payment status is ${paymentStatus}. Order must be PAID before completion.`,
        paymentStatus,
        orderStatus,
      };
    }

    // Also verify order is in a completable state
    const completableStatuses = ["SERVED", "READY", "SERVING"];
    if (!completableStatuses.includes(orderStatus)) {
      return {
        isValid: false,
        error: `Cannot complete order: current status is ${orderStatus}. Order must be SERVED, READY, or SERVING before completion.`,
        paymentStatus,
        orderStatus,
      };
    }

    return {
      isValid: true,
      paymentStatus,
      orderStatus,
    };
  } catch (error) {
    logger.error("[PAYMENT VALIDATION] Validation error", {
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      isValid: false,
      error: "Failed to validate order payment status",
    };
  }
}

/**
 * Validate multiple orders can be completed (all must be PAID)
 */
export async function validateBulkOrderCompletion(
  supabase: SupabaseClient,
  orderIds: string[],
  venueId: string
): Promise<PaymentValidationResult & { unpaidOrderIds?: string[] }> {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, payment_status, order_status")
      .in("id", orderIds)
      .eq("venue_id", venueId);

    if (error) {
      logger.error("[PAYMENT VALIDATION] Error fetching orders", {
        orderIds,
        error: error.message,
      });
      return {
        isValid: false,
        error: "Failed to fetch orders for validation",
      };
    }

    if (!orders || orders.length === 0) {
      return {
        isValid: false,
        error: "No orders found",
      };
    }

    // Filter out unpaid orders
    const unpaidOrders = orders.filter(
      (order) => (order.payment_status || "").toString().toUpperCase() !== "PAID"
    );

    if (unpaidOrders.length > 0) {
      return {
        isValid: false,
        error: `Cannot complete ${unpaidOrders.length} unpaid order(s). All orders must be PAID before completion.`,
        unpaidOrderIds: unpaidOrders.map((o) => o.id),
      };
    }

    // Filter to only completable statuses
    const completableStatuses = ["SERVED", "READY", "SERVING"];
    const nonCompletableOrders = orders.filter(
      (order) => !completableStatuses.includes((order.order_status || "").toString().toUpperCase())
    );

    if (nonCompletableOrders.length > 0) {
      logger.warn("[PAYMENT VALIDATION] Some orders not in completable status", {
        orderIds: nonCompletableOrders.map((o) => o.id),
      });
      // Return valid but with warning - caller can filter
      return {
        isValid: true,
      };
    }

    return {
      isValid: true,
    };
  } catch (error) {
    logger.error("[PAYMENT VALIDATION] Bulk validation error", {
      orderIds,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      isValid: false,
      error: "Failed to validate orders payment status",
    };
  }
}


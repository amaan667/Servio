/**
 * Payment Validation Utilities
 * Ensures orders can only be completed if they are paid
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentValidationResult {

}

/**
 * Validate that an order can be completed (must be PAID)
 */
export async function validateOrderCompletion(

    const { data: order, error } = await supabase
      .from("orders")
      .select("payment_status, order_status")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      
      return {

      };
    }

    const paymentStatus = (order.payment_status || "").toString().toUpperCase();
    const orderStatus = (order.order_status || "").toString().toUpperCase();

    // CRITICAL: Order must be PAID before completion
    if (paymentStatus !== "PAID") {
      return {

        error: `Cannot complete order: payment status is ${paymentStatus}. Order must be PAID before completion.`,
        paymentStatus,
        orderStatus,
      };
    }

    // Also verify order is in a completable state
    const completableStatuses = ["SERVED", "READY", "SERVING"];
    if (!completableStatuses.includes(orderStatus)) {
      return {

        error: `Cannot complete order: current status is ${orderStatus}. Order must be SERVED, READY, or SERVING before completion.`,
        paymentStatus,
        orderStatus,
      };
    }

    return {

      paymentStatus,
      orderStatus,
    };
  } catch (error) {
    
    return {

    };
  }
}

/**
 * Validate multiple orders can be completed (all must be PAID)
 */
export async function validateBulkOrderCompletion(

): Promise<PaymentValidationResult & { unpaidOrderIds?: string[] }> {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, payment_status, order_status")
      .in("id", orderIds)
      .eq("venue_id", venueId);

    if (error) {
      
      return {

      };
    }

    if (!orders || orders.length === 0) {
      return {

      };
    }

    // Filter out unpaid orders
    const unpaidOrders = orders.filter(
      (order) => (order.payment_status || "").toString().toUpperCase() !== "PAID"
    );

    if (unpaidOrders.length > 0) {
      return {

        error: `Cannot complete ${unpaidOrders.length} unpaid order(s). All orders must be PAID before completion.`,

      };
    }

    // Filter to only completable statuses
    const completableStatuses = ["SERVED", "READY", "SERVING"];
    const nonCompletableOrders = orders.filter(
      (order) => !completableStatuses.includes((order.order_status || "").toString().toUpperCase())
    );

    if (nonCompletableOrders.length > 0) {
       => o.id),

      // Return valid but with warning - caller can filter
      return {

      };
    }

    return {

    };
  } catch (error) {
    
    return {

    };
  }
}

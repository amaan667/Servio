/**
 * Transaction Safety Utilities
 * Provides helpers for ensuring data consistency in critical operations
 */

import { SupabaseClient } from "@supabase/supabase-js";

import { trackOrderError } from "@/lib/monitoring/error-tracking";

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rollback?: () => Promise<void>;
}

/**
 * Execute order creation with KDS tickets in a safe manner
 * Note: Supabase doesn't support true transactions, so we use best-effort rollback
 */
export async function createOrderWithKDSTickets<T>(
  supabase: SupabaseClient,
  orderData: Record<string, unknown>,
  createKDSTicketsFn: (supabase: SupabaseClient, order: T) => Promise<void>
): Promise<TransactionResult<T>> {
  let createdOrderId: string | null = null;
  let createdOrder: T | null = null;

  try {
    // Step 1: Create the order
    const { data: insertedOrder, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select("*")
      .single();

    if (orderError || !insertedOrder) {
      return {
        success: false,
        error: orderError?.message || "Failed to create order",
      };
    }

    createdOrderId = (insertedOrder as { id: string }).id;
    createdOrder = insertedOrder as T;

    // Step 2: Create KDS tickets
    try {
      await createKDSTicketsFn(supabase, createdOrder);
    } catch (kdsError) {
      // Track but don't fail - KDS tickets are non-critical
      trackOrderError(kdsError, {
        orderId: createdOrderId,
        action: "kds_ticket_creation",
      });

      // Continue - order is created successfully even if KDS fails
    }

    return {
      success: true,
      data: createdOrder,
      rollback: async () => {
        if (createdOrderId) {
          await supabase.from("orders").delete().eq("id", createdOrderId);
        }
      },
    };
  } catch (error) {
    trackOrderError(error, {
      action: "order_creation_transaction",
    });

    // Attempt rollback if order was created
    if (createdOrderId) {
      try {
        await supabase.from("orders").delete().eq("id", createdOrderId);
      } catch (rollbackError) {
        /* Error handled silently */
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Validate order data before creation
 */
export function validateOrderData(orderData: Record<string, unknown>): {
  isValid: boolean;
  error?: string;
} {
  // Required fields
  if (!orderData.venue_id || typeof orderData.venue_id !== "string") {
    return { isValid: false, error: "venue_id is required and must be a string" };
  }

  if (!orderData.customer_name || typeof orderData.customer_name !== "string") {
    return { isValid: false, error: "customer_name is required and must be a string" };
  }

  if (!orderData.customer_phone || typeof orderData.customer_phone !== "string") {
    return { isValid: false, error: "customer_phone is required and must be a string" };
  }

  if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
    return { isValid: false, error: "items must be a non-empty array" };
  }

  if (typeof orderData.total_amount !== "number" || isNaN(orderData.total_amount)) {
    return { isValid: false, error: "total_amount must be a valid number" };
  }

  // Validate total amount is positive
  if (orderData.total_amount <= 0) {
    return { isValid: false, error: "total_amount must be greater than 0" };
  }

  return { isValid: true };
}

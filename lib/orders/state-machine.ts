/**
 * Order State Machine - Server-side enforcement of order lifecycle transitions
 * Prevents invalid state changes and ensures business rule compliance
 */

import { logger } from "@/lib/logger";

export type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "IN_PREP"
  | "READY"
  | "SERVING"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "PAID" | "UNPAID" | "REFUNDED" | "PARTIALLY_PAID" | "TILL";
export type KitchenStatus = "pending" | "preparing" | "ready" | "completed";
export type ServiceStatus = "pending" | "serving" | "served";
export type CompletionStatus = "pending" | "completed";

/**
 * Valid order status transitions
 * Defines the state machine for order lifecycle
 */
export const ORDER_STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PREP", "CANCELLED"],
  IN_PREP: ["READY", "CANCELLED"],
  READY: ["SERVING", "SERVED", "CANCELLED"],
  SERVING: ["SERVED", "COMPLETED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Validate order transition with comprehensive business rules
 */
export function validateOrderTransition(
  currentOrder: {
    order_status: OrderStatus;
    payment_status: PaymentStatus;
    kitchen_status?: KitchenStatus;
    service_status?: ServiceStatus;
    completion_status?: CompletionStatus;
  },
  targetStatus: OrderStatus,
  forceComplete: boolean = false
): { allowed: boolean; message: string; reason?: string } {
  const { order_status: currentStatus, payment_status: paymentStatus } = currentOrder;

  // Check if transition is valid in state machine
  const validTransitions = ORDER_STATE_TRANSITIONS[currentStatus] || [];
  if (!validTransitions.includes(targetStatus)) {
    return {
      allowed: false,
      message: `Invalid transition from ${currentStatus} to ${targetStatus}`,
      reason: "invalid_transition",
    };
  }

  // Special validation for COMPLETED status
  if (targetStatus === "COMPLETED") {
    // Check payment status - must be PAID, TILL, or allow force completion
    const validPaymentStatuses: PaymentStatus[] = ["PAID", "TILL"];
    const paymentValid = validPaymentStatuses.includes(paymentStatus);

    if (!paymentValid && !forceComplete) {
      return {
        allowed: false,
        message: `Cannot complete order with payment status: ${paymentStatus}. Order must be paid or marked as paid.`,
        reason: "payment_required",
      };
    }

    // Check that order is in a completable state
    const completableStatuses: OrderStatus[] = ["SERVING", "SERVED"];
    if (!completableStatuses.includes(currentStatus) && !forceComplete) {
      return {
        allowed: false,
        message: `Order must be SERVING or SERVED before completion. Current status: ${currentStatus}`,
        reason: "invalid_completion_state",
      };
    }

    // Check kitchen completion for non-force completions
    if (!forceComplete && currentOrder.kitchen_status !== "completed") {
      return {
        allowed: false,
        message: "All kitchen tickets must be completed before order can be marked complete",
        reason: "kitchen_not_complete",
      };
    }

    // Check service completion for non-force completions
    if (!forceComplete && currentOrder.service_status !== "served") {
      return {
        allowed: false,
        message: "Order must be fully served before completion",
        reason: "service_not_complete",
      };
    }
  }

  // Validate SERVING transition
  if (targetStatus === "SERVING") {
    if (currentStatus !== "READY") {
      return {
        allowed: false,
        message: "Order must be READY before serving can begin",
        reason: "not_ready_for_service",
      };
    }
  }

  // Validate SERVED transition
  if (targetStatus === "SERVED") {
    const validFromStatuses: OrderStatus[] = ["READY", "SERVING"];
    if (!validFromStatuses.includes(currentStatus)) {
      return {
        allowed: false,
        message: `Order must be READY or SERVING before it can be served. Current status: ${currentStatus}`,
        reason: "invalid_serve_state",
      };
    }

    // All kitchen tickets must be completed
    if (currentOrder.kitchen_status !== "completed") {
      return {
        allowed: false,
        message: "All kitchen tickets must be completed before order can be served",
        reason: "kitchen_not_complete",
      };
    }
  }

  // Validate IN_PREP transition
  if (targetStatus === "IN_PREP") {
    if (currentStatus !== "ACCEPTED") {
      return {
        allowed: false,
        message: "Order must be ACCEPTED before preparation can begin",
        reason: "not_accepted",
      };
    }
  }

  // Validate READY transition
  if (targetStatus === "READY") {
    if (currentStatus !== "IN_PREP") {
      return {
        allowed: false,
        message: "Order must be IN_PREP before it can be marked ready",
        reason: "not_in_prep",
      };
    }
  }

  // All validations passed
  return {
    allowed: true,
    message: `Transition from ${currentStatus} to ${targetStatus} is valid`,
  };
}

/**
 * Get all possible next states for an order
 */
export function getPossibleNextStates(currentStatus: OrderStatus): OrderStatus[] {
  return ORDER_STATE_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if an order status is terminal (no further transitions allowed)
 */
export function isTerminalState(status: OrderStatus): boolean {
  return ORDER_STATE_TRANSITIONS[status]?.length === 0;
}

/**
 * Validate that an order can be cancelled from its current state
 */
export function canCancelOrder(currentStatus: OrderStatus): boolean {
  // Orders can be cancelled from any non-terminal state
  return !isTerminalState(currentStatus);
}
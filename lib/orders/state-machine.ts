/**
 * Order State Machine - Server-side enforcement of order lifecycle transitions
 * Prevents invalid state changes and ensures business rule compliance
 */

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

  },

): { allowed: boolean; message: string; reason?: string } {
  const { order_status: currentStatus, payment_status: paymentStatus } = currentOrder;

  // Check if transition is valid in state machine
  const validTransitions = ORDER_STATE_TRANSITIONS[currentStatus] || [];
  if (!validTransitions.includes(targetStatus)) {
    return {

      message: `Invalid transition from ${currentStatus} to ${targetStatus}`,

    };
  }

  // Special validation for COMPLETED status
  if (targetStatus === "COMPLETED") {
    // Check payment status - must be PAID, TILL, or allow force completion
    const validPaymentStatuses: PaymentStatus[] = ["PAID", "TILL"];
    const paymentValid = validPaymentStatuses.includes(paymentStatus);

    if (!paymentValid && !forceComplete) {
      return {

        message: `Cannot complete order with payment status: ${paymentStatus}. Order must be paid or marked as paid.`,

      };
    }

    // Check that order is in a completable state
    const completableStatuses: OrderStatus[] = ["SERVING", "SERVED"];
    if (!completableStatuses.includes(currentStatus) && !forceComplete) {
      return {

        message: `Order must be SERVING or SERVED before completion. Current status: ${currentStatus}`,

      };
    }

    // Check kitchen completion for non-force completions
    if (!forceComplete && currentOrder.kitchen_status !== "completed") {
      return {

      };
    }

    // Check service completion for non-force completions
    if (!forceComplete && currentOrder.service_status !== "served") {
      return {

      };
    }
  }

  // Validate SERVING transition
  if (targetStatus === "SERVING") {
    if (currentStatus !== "READY") {
      return {

      };
    }
  }

  // Validate SERVED transition
  if (targetStatus === "SERVED") {
    const validFromStatuses: OrderStatus[] = ["READY", "SERVING"];
    if (!validFromStatuses.includes(currentStatus)) {
      return {

        message: `Order must be READY or SERVING before it can be served. Current status: ${currentStatus}`,

      };
    }

    // All kitchen tickets must be completed
    if (currentOrder.kitchen_status !== "completed") {
      return {

      };
    }
  }

  // Validate IN_PREP transition
  if (targetStatus === "IN_PREP") {
    if (currentStatus !== "ACCEPTED") {
      return {

      };
    }
  }

  // Validate READY transition
  if (targetStatus === "READY") {
    if (currentStatus !== "IN_PREP") {
      return {

      };
    }
  }

  // All validations passed
  return {

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
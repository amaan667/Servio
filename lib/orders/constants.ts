/**
 * Order Status Constants
 * Centralized status definitions for type safety
 */

// Order Status
export const OrderStatus = {
  PENDING: "PENDING",
  PLACED: "PLACED",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

// Payment Status
export const PaymentStatus = {
  UNPAID: "UNPAID",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  FAILED: "FAILED",
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// Payment Method
export const PaymentMethod = {
  PAY_NOW: "PAY_NOW",
  PAY_AT_TILL: "PAY_AT_TILL",
  PAY_LATER: "PAY_LATER",
  CASH: "CASH",
  CARD: "CARD",
} as const;

export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// Payment Mode
export const PaymentMode = {
  ONLINE: "online",
  OFFLINE: "offline",
  DEFERRED: "deferred",
} as const;

export type PaymentModeType = (typeof PaymentMode)[keyof typeof PaymentMode];

// Fulfillment Type
export const FulfillmentType = {
  TABLE: "table",
  COUNTER: "counter",
  DELIVERY: "delivery",
  PICKUP: "pickup",
} as const;

export type FulfillmentTypeType = (typeof FulfillmentType)[keyof typeof FulfillmentType];

// Order Source
export const OrderSource = {
  QR: "qr",
  COUNTER: "counter",
  POS: "pos",
  DELIVERY_PARTNER: "delivery_partner",
} as const;

export type OrderSourceType = (typeof OrderSource)[keyof typeof OrderSource];

// Default values
export const OrderDefaults = {
  STATUS: OrderStatus.PLACED,
  PAYMENT_STATUS: PaymentStatus.UNPAID,
  PAYMENT_METHOD: PaymentMethod.PAY_NOW,
  PAYMENT_MODE: PaymentMode.ONLINE,
  SOURCE: OrderSource.QR,
  FULFILLMENT_TYPE: FulfillmentType.TABLE,
  REQUIRES_COLLECTION: false,
} as const;

// Status transitions (valid order lifecycle)
export const ValidStatusTransitions: Record<OrderStatusType, OrderStatusType[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PLACED, OrderStatus.CANCELLED],
  [OrderStatus.PLACED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SERVED],
  [OrderStatus.SERVED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

// Terminal states (orders that cannot change)
export const TerminalStatuses = new Set([OrderStatus.COMPLETED, OrderStatus.CANCELLED]);

// Paid statuses (indicates payment has been made)
export const PaidStatuses = new Set([
  PaymentStatus.PAID,
  PaymentStatus.REFUNDED,
  PaymentStatus.PARTIALLY_REFUNDED,
]);

// Unpaid statuses
export const UnpaidStatuses = new Set([PaymentStatus.UNPAID, PaymentStatus.FAILED]);

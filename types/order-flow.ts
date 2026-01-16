export const QR_TYPES = ["TABLE_FULL_SERVICE", "TABLE_COLLECTION", "COUNTER"] as const;
export type QrType = (typeof QR_TYPES)[number];

export const PAYMENT_METHODS = ["PAY_NOW", "PAY_LATER", "PAY_AT_TILL"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  "NEW",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

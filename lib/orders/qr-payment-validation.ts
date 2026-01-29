import type { PaymentMethod, PaymentStatus, QrType } from "@/types/order-flow";

export const QR_TYPE_LABELS: Record<QrType, string> = {
  TABLE_FULL_SERVICE: "TABLE_FULL_SERVICE",
  TABLE_COLLECTION: "TABLE_COLLECTION",
  COUNTER: "COUNTER",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PAY_NOW: "PAY_NOW",
  PAY_LATER: "PAY_LATER",
  PAY_AT_TILL: "PAY_AT_TILL",
};

export function normalizeQrType(value?: string | null): QrType | null {
  if (!value) return null;
  const normalized = value.toString().trim().toUpperCase();
  if (normalized === "TABLE_FULL_SERVICE") return "TABLE_FULL_SERVICE";
  if (normalized === "TABLE_COLLECTION" || normalized === "TABLE_PICKUP") return "TABLE_COLLECTION";
  if (normalized === "COUNTER") return "COUNTER";
  return null;
}

export function normalizePaymentMethod(value?: string | null): PaymentMethod | null {
  if (!value) return null;
  const normalized = value.toString().trim().toUpperCase();
  if (normalized === "PAY_NOW" || normalized === "STRIPE" || normalized === "CARD")
    return "PAY_NOW";
  if (normalized === "PAY_LATER") return "PAY_LATER";
  if (normalized === "PAY_AT_TILL" || normalized === "TILL" || normalized === "CASH")
    return "PAY_AT_TILL";
  return null;
}

export function normalizePaymentStatus(value?: string | null): PaymentStatus | null {
  if (!value) return null;
  const normalized = value.toString().trim().toUpperCase();
  if (normalized === "PAID") return "PAID";
  if (normalized === "UNPAID") return "UNPAID";
  return null;
}

export function deriveQrTypeFromOrder(order: {
  qr_type?: string | null;
  fulfillment_type?: string | null;
  source?: string | null;
  requires_collection?: boolean | null;
}): QrType {
  const explicit = normalizeQrType(order.qr_type);
  if (explicit) return explicit;

  const fulfillment = (order.fulfillment_type || "").toLowerCase();
  const source = (order.source || "").toLowerCase();

  if (fulfillment === "counter" || source === "counter" || source === "qr_counter") {
    return "COUNTER";
  }

  if (order.requires_collection) {
    return "TABLE_COLLECTION";
  }

  return "TABLE_FULL_SERVICE";
}

export function getAllowedPaymentMethods(input: {
  qrType: QrType;
  allowPayAtTillForTableCollection: boolean;
}): PaymentMethod[] {
  const { qrType, allowPayAtTillForTableCollection } = input;

  if (qrType === "TABLE_FULL_SERVICE") {
    return ["PAY_NOW", "PAY_LATER", "PAY_AT_TILL"];
  }

  if (qrType === "TABLE_COLLECTION") {
    return allowPayAtTillForTableCollection ? ["PAY_NOW", "PAY_AT_TILL"] : ["PAY_NOW"];
  }

  return ["PAY_NOW", "PAY_AT_TILL"];
}

export function validatePaymentMethodForQrType(input: {
  qrType: QrType;
  paymentMethod: PaymentMethod;
  allowPayAtTillForTableCollection: boolean;
}): { ok: boolean; error?: string } {
  const { qrType, paymentMethod, allowPayAtTillForTableCollection } = input;
  const allowed = getAllowedPaymentMethods({ qrType, allowPayAtTillForTableCollection });

  if (!allowed.includes(paymentMethod)) {
    return {
      ok: false,
      error: `Payment method ${PAYMENT_METHOD_LABELS[paymentMethod]} is not allowed for ${QR_TYPE_LABELS[qrType]} QR codes.`,
    };
  }

  return { ok: true };
}

export function validateOrderStatusTransition(input: {
  qrType: QrType;
  paymentStatus: PaymentStatus;
  currentStatus: string;
  nextStatus: string;
}): { ok: boolean; error?: string } {
  const { qrType, paymentStatus, currentStatus, nextStatus } = input;
  const current = currentStatus.toUpperCase();
  const next = nextStatus.toUpperCase();

  if (next === "COMPLETED" && paymentStatus !== "PAID") {
    return {
      ok: false,
      error:
        "Cannot complete order: payment status is UNPAID. Order must be PAID before completion.",
    };
  }

  if (next === "SERVED" && qrType !== "TABLE_FULL_SERVICE") {
    return {
      ok: false,
      error: `SERVED status is only allowed for TABLE_FULL_SERVICE QR codes.`,
    };
  }

  if (next === "SERVED" && current !== "READY") {
    return {
      ok: false,
      error: "Order must be READY before it can be marked as SERVED.",
    };
  }

  if (next === "COMPLETED") {
    if (qrType === "TABLE_FULL_SERVICE" && current !== "SERVED") {
      return {
        ok: false,
        error: "Order must be SERVED before it can be COMPLETED for table service.",
      };
    }

    if ((qrType === "TABLE_COLLECTION" || qrType === "COUNTER") && current !== "READY") {
      return {
        ok: false,
        error: `Order must be READY before it can be COMPLETED for ${QR_TYPE_LABELS[qrType]} orders.`,
      };
    }
  }

  return { ok: true };
}

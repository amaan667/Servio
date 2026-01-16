import { describe, it, expect } from "vitest";
import {
  getAllowedPaymentMethods,
  validateOrderStatusTransition,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";

describe("QR payment validation", () => {
  it("allows all methods for table full service", () => {
    const allowed = getAllowedPaymentMethods({
      qrType: "TABLE_FULL_SERVICE",
      allowPayAtTillForTableCollection: false,
    });
    expect(allowed).toEqual(["PAY_NOW", "PAY_LATER", "PAY_AT_TILL"]);
  });

  it("disallows pay later for table collection", () => {
    const validation = validatePaymentMethodForQrType({
      qrType: "TABLE_COLLECTION",
      paymentMethod: "PAY_LATER",
      allowPayAtTillForTableCollection: false,
    });
    expect(validation.ok).toBe(false);
  });

  it("allows pay at till for table collection when enabled", () => {
    const validation = validatePaymentMethodForQrType({
      qrType: "TABLE_COLLECTION",
      paymentMethod: "PAY_AT_TILL",
      allowPayAtTillForTableCollection: true,
    });
    expect(validation.ok).toBe(true);
  });

  it("disallows pay later for counter", () => {
    const validation = validatePaymentMethodForQrType({
      qrType: "COUNTER",
      paymentMethod: "PAY_LATER",
      allowPayAtTillForTableCollection: false,
    });
    expect(validation.ok).toBe(false);
  });

  it("blocks completion when unpaid", () => {
    const validation = validateOrderStatusTransition({
      qrType: "TABLE_FULL_SERVICE",
      paymentStatus: "UNPAID",
      currentStatus: "SERVED",
      nextStatus: "COMPLETED",
    });
    expect(validation.ok).toBe(false);
  });

  it("requires served before completion for full service", () => {
    const validation = validateOrderStatusTransition({
      qrType: "TABLE_FULL_SERVICE",
      paymentStatus: "PAID",
      currentStatus: "READY",
      nextStatus: "COMPLETED",
    });
    expect(validation.ok).toBe(false);
  });

  it("requires ready before completion for collection", () => {
    const validation = validateOrderStatusTransition({
      qrType: "TABLE_COLLECTION",
      paymentStatus: "PAID",
      currentStatus: "SERVED",
      nextStatus: "COMPLETED",
    });
    expect(validation.ok).toBe(false);
  });
});

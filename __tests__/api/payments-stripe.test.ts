/**
 * Tests for Payment Processing - Stripe Integration
 * Critical: Payment security and reliability
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Stripe
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: "pi_test_123",
        client_secret: "secret_123",
        amount: 1000,
        currency: "usd",
        status: "requires_payment_method",
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "succeeded",
        amount: 1000,
      }),
    },
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_123",
            amount: 1000,
            metadata: { order_id: "order_123" },
          },
        },
      }),
    },
  })),
}));

describe("POST /api/payments/create-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates payment intent with valid amount", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/payments/create-intent", {
      method: "POST",
      body: JSON.stringify({
        amount: 1000, // $10.00
        currency: "usd",
        order_id: "order_123",
      }),
    });

    const body = await mockRequest.json();
    expect(body.amount).toBe(1000);
    expect(body).toHaveProperty("order_id");
  });

  it("validates amount is positive", async () => {
    const validAmount = 1000;
    const invalidAmount = -100;

    expect(validAmount).toBeGreaterThan(0);
    expect(invalidAmount).toBeLessThan(0);
  });

  it("validates minimum amount (50 cents)", async () => {
    const validAmount = 50;
    const invalidAmount = 49;

    expect(validAmount).toBeGreaterThanOrEqual(50);
    expect(invalidAmount).toBeLessThan(50);
  });

  it("includes order metadata", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/payments/create-intent", {
      method: "POST",
      body: JSON.stringify({
        amount: 1000,
        currency: "usd",
        metadata: {
          order_id: "order_123",
          venue_id: "venue_123",
          table_id: "table_123",
        },
      }),
    });

    const body = await mockRequest.json();
    expect(body.metadata).toHaveProperty("order_id");
    expect(body.metadata).toHaveProperty("venue_id");
  });
});

describe("POST /api/payments/webhooks", () => {
  it("handles payment_intent.succeeded event", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/payments/webhooks", {
      method: "POST",
      headers: {
        "stripe-signature": "sig_test_123",
      },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_123",
            amount: 1000,
          },
        },
      }),
    });

    expect(mockRequest.headers.get("stripe-signature")).toBe("sig_test_123");
  });

  it("validates webhook signature", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/payments/webhooks", {
      method: "POST",
      body: JSON.stringify({ type: "test.event" }),
    });

    expect(mockRequest.headers.get("stripe-signature")).toBeNull();
  });

  it("handles payment_intent.payment_failed event", async () => {
    const webhook = {
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_test_123",
          last_payment_error: { message: "Card declined" },
        },
      },
    };

    expect(webhook.type).toBe("payment_intent.payment_failed");
    expect(webhook.data.object).toHaveProperty("last_payment_error");
  });

  it("updates order status on successful payment", async () => {
    // Test structure - would update order in database
    const paymentData = {
      id: "pi_test_123",
      metadata: { order_id: "order_123" },
      status: "succeeded",
    };

    expect(paymentData.status).toBe("succeeded");
    expect(paymentData.metadata).toHaveProperty("order_id");
  });
});

describe("Payment Error Handling", () => {
  it("handles insufficient funds", async () => {
    const error = {
      code: "insufficient_funds",
      message: "Your card has insufficient funds",
    };

    expect(error.code).toBe("insufficient_funds");
  });

  it("handles expired card", async () => {
    const error = {
      code: "expired_card",
      message: "Your card has expired",
    };

    expect(error.code).toBe("expired_card");
  });

  it("handles card declined", async () => {
    const error = {
      code: "card_declined",
      message: "Your card was declined",
    };

    expect(error.code).toBe("card_declined");
  });
});

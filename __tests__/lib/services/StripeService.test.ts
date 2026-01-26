/**
 * StripeService Tests
 * Tests for Stripe service methods
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripeService } from "@/lib/services/StripeService";
import { stripe } from "@/lib/stripe-client";

vi.mock("@/lib/stripe-client", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

describe("StripeService", () => {
  let stripeService: StripeService;

  beforeEach(() => {
    stripeService = new StripeService();
    vi.clearAllMocks();
  });

  describe("createOrderCheckoutSession", () => {
    it("should create checkout session with correct parameters", async () => {
      const mockSession = {
        id: "session_123",
        url: "https://checkout.stripe.com/session_123",
      };

      vi.mocked(stripe.checkout.sessions.create).mockResolvedValue(mockSession as never);

      const result = await stripeService.createOrderCheckoutSession({
        amount: 25.50,
        venueName: "Test Venue",
        venueId: "venue-1",
        tableNumber: "5",
        orderId: "order-1",
        customerName: "Test Customer",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("session_123");
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: expect.any(Array),
          metadata: expect.objectContaining({
            orderId: "order-1",
            venueId: "venue-1",
          }),
        })
      );
    });

    it("should include customer email if provided", async () => {
      const mockSession = { id: "session_123", url: "https://checkout.stripe.com/session_123" };
      vi.mocked(stripe.checkout.sessions.create).mockResolvedValue(mockSession as never);

      await stripeService.createOrderCheckoutSession({
        amount: 25.50,
        venueName: "Test",
        venueId: "venue-1",
        tableNumber: "1",
        orderId: "order-1",
        customerName: "Test",
        customerEmail: "test@example.com",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: "test@example.com",
        })
      );
    });
  });
});

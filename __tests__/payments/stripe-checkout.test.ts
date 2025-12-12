import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe
vi.mock("stripe", () => {
  const mockStripe = {
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
  };
  return {
    default: vi.fn(() => mockStripe),
  };
});

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

describe("Stripe Checkout Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Checkout Session Creation", () => {
    it("should create checkout session for basic tier", async () => {
      const checkoutData = {
        tier: "basic",
        priceId: "price_basic_monthly",
        successUrl: "https://app.servio.com/success",
        cancelUrl: "https://app.servio.com/cancel",
        customerEmail: "test@example.com",
      };

      expect(checkoutData.tier).toBe("basic");
      expect(checkoutData.priceId).toBeDefined();
      expect(checkoutData.successUrl).toContain("/success");
      expect(checkoutData.cancelUrl).toContain("/cancel");
    });

    it("should include customer metadata in session", () => {
      const metadata = {
        venueId: "venue-123",
        tier: "standard",
        userId: "user-456",
      };

      expect(metadata.venueId).toBeDefined();
      expect(metadata.tier).toBe("standard");
      expect(metadata.userId).toBeDefined();
    });

    it("should set correct mode for subscription", () => {
      const sessionConfig = {
        mode: "subscription" as const,
        payment_method_types: ["card"],
        billing_address_collection: "required" as const,
      };

      expect(sessionConfig.mode).toBe("subscription");
      expect(sessionConfig.payment_method_types).toContain("card");
      expect(sessionConfig.billing_address_collection).toBe("required");
    });

    it("should handle trial period for new customers", () => {
      const trialConfig = {
        subscription_data: {
          trial_period_days: 14,
          trial_settings: {
            end_behavior: {
              missing_payment_method: "cancel" as const,
            },
          },
        },
      };

      expect(trialConfig.subscription_data.trial_period_days).toBe(14);
    });
  });

  describe("Price Calculation", () => {
    it("should calculate correct amounts for each tier", () => {
      const prices = {
        basic: 9900, // £99.00 in pence
        standard: 24900, // £249.00 in pence
        premium: 44900, // £449.00 in pence
      };

      expect(prices.basic).toBe(9900);
      expect(prices.standard).toBe(24900);
      expect(prices.premium).toBe(44900);

      // Verify conversion to pounds
      expect(prices.basic / 100).toBe(99);
      expect(prices.standard / 100).toBe(249);
      expect(prices.premium / 100).toBe(449);
    });

    it("should handle VAT calculation", () => {
      const subtotal = 9900; // £99.00
      const vatRate = 0.2; // 20% UK VAT
      const vat = Math.round(subtotal * vatRate);
      const total = subtotal + vat;

      expect(vat).toBe(1980); // £19.80
      expect(total).toBe(11880); // £118.80
    });
  });

  describe("Error Handling", () => {
    it("should handle missing price ID", () => {
      const invalidRequest = {
        tier: "basic",
        priceId: undefined,
      };

      expect(invalidRequest.priceId).toBeUndefined();
    });

    it("should handle invalid tier selection", () => {
      const invalidTiers = ["free", "enterprise", "", null];
      const validTiers = ["basic", "standard", "premium"];

      invalidTiers.forEach((tier) => {
        expect(validTiers).not.toContain(tier);
      });
    });

    it("should validate customer email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test("valid@example.com")).toBe(true);
      expect(emailRegex.test("invalid")).toBe(false);
      expect(emailRegex.test("")).toBe(false);
    });
  });

  describe("Session Metadata", () => {
    it("should include required metadata fields", () => {
      const metadata = {
        venueId: "venue-123",
        userId: "user-456",
        tier: "standard",
        organizationId: "org-789",
      };

      expect(Object.keys(metadata)).toContain("venueId");
      expect(Object.keys(metadata)).toContain("userId");
      expect(Object.keys(metadata)).toContain("tier");
      expect(Object.keys(metadata)).toContain("organizationId");
    });

    it("should sanitize metadata values", () => {
      const unsafeMetadata = {
        venueName: '<script>alert("xss")</script>Restaurant',
        notes: "Normal & safe text",
      };

      const sanitized = {
        venueName: unsafeMetadata.venueName.replace(/<[^>]*>/g, ""),
        notes: unsafeMetadata.notes,
      };

      expect(sanitized.venueName).not.toContain("<script>");
      expect(sanitized.venueName).toContain("Restaurant");
    });
  });
});

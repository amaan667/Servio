/**
 * Tests for validation schemas (lib/validation/schemas.ts).
 * Note: sanitizeString/sanitizeHTML are not in this codebase; schema validation only.
 */

import { describe, it, expect } from "vitest";
import {
  EmailSchema,
  PhoneSchema,
  CreateOrderSchema,
  MenuItemSchema,
  VenueIdSchema,
} from "@/lib/validation/schemas";

describe("Input Validation", () => {
  describe("EmailSchema", () => {
    it("should validate correct emails", () => {
      expect(EmailSchema.safeParse("test@example.com").success).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(EmailSchema.safeParse("invalid-email").success).toBe(false);
      expect(EmailSchema.safeParse("").success).toBe(false);
    });
  });

  describe("PhoneSchema", () => {
    it("should validate international phone numbers", () => {
      expect(PhoneSchema.safeParse("+44123456789").success).toBe(true);
      expect(PhoneSchema.safeParse("+12025551234").success).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(PhoneSchema.safeParse("023").success).toBe(false);
      expect(PhoneSchema.safeParse("abc").success).toBe(false);
    });
  });

  describe("VenueIdSchema", () => {
    it("should accept valid UUIDs", () => {
      expect(VenueIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    });

    it("should reject non-UUID strings", () => {
      expect(VenueIdSchema.safeParse("venue-123").success).toBe(false);
    });
  });

  describe("CreateOrderSchema", () => {
    it("should validate complete order payload", () => {
      const validOrder = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        customer_name: "John Doe",
        customer_phone: "+441234567890",
        items: [
          {
            menu_item_id: "550e8400-e29b-41d4-a716-446655440001",
            quantity: 2,
            price: 12.99,
          },
        ],
        total_amount: 25.98,
        payment_method: "card",
      };

      const result = CreateOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it("should reject orders with missing required fields", () => {
      const invalidOrder = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        items: [],
      };

      expect(CreateOrderSchema.safeParse(invalidOrder).success).toBe(false);
    });

    it("should reject invalid payment_method", () => {
      const order = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        customer_phone: "+441234567890",
        items: [
          { menu_item_id: "550e8400-e29b-41d4-a716-446655440001", quantity: 1, price: 10 },
        ],
        total_amount: 10,
        payment_method: "INVALID",
      };
      expect(CreateOrderSchema.safeParse(order).success).toBe(false);
    });
  });

  describe("MenuItemSchema", () => {
    it("should validate menu items with required fields", () => {
      const item = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Margherita Pizza",
        description: "Classic Italian pizza",
        price: 12.99,
        category: "Pizza",
        is_available: true,
      };

      expect(MenuItemSchema.safeParse(item).success).toBe(true);
    });

    it("should reject negative prices", () => {
      const item = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Item",
        price: -5.99,
        category: "Test",
      };

      expect(MenuItemSchema.safeParse(item).success).toBe(false);
    });
  });
});

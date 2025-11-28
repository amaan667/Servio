 
/**
 * @fileoverview Tests for validation schemas
 * @module __tests__/lib/validation/schemas
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Define common schemas for testing
const EmailSchema = z.string().email();
const PriceSchema = z.number().positive().max(10000);
const VenueIdSchema = z.string().uuid();
const MenuItemSchema = z.object({
  name: z.string().min(3).max(100),
  price: PriceSchema,
  category: z.string().min(1),
  description: z.string().max(500).optional(),
  is_available: z.boolean().default(true),
});

describe("Validation Schemas", () => {
  describe("EmailSchema", () => {
    it("should validate correct email format", () => {
      const validEmails = ["test@example.com", "user+tag@domain.co.uk", "john.doe@company.org"];

      validEmails.forEach((email) => {
        const result = EmailSchema.safeParse(email);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid email format", () => {
      const invalidEmails = [
        "invalid",
        "missing@domain",
        "@example.com",
        "user@",
        "user @domain.com",
      ];

      invalidEmails.forEach((email) => {
        const result = EmailSchema.safeParse(email);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("PriceSchema", () => {
    it("should validate positive prices", () => {
      const validPrices = [0.01, 1, 9.99, 100, 9999.99];

      validPrices.forEach((price) => {
        const result = PriceSchema.safeParse(price);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid prices", () => {
      const invalidPrices = [0, -1, -9.99, 10001, 99999];

      invalidPrices.forEach((price) => {
        const result = PriceSchema.safeParse(price);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("VenueIdSchema", () => {
    it("should validate UUID format", () => {
      const validUUIDs = [
        "123e4567-e89b-12d3-a456-426614174000",
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      ];

      validUUIDs.forEach((uuid) => {
        const result = VenueIdSchema.safeParse(uuid);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid UUID format", () => {
      const invalidUUIDs = ["123", "not-a-uuid", "123e4567-e89b-12d3-a456", ""];

      invalidUUIDs.forEach((uuid) => {
        const result = VenueIdSchema.safeParse(uuid);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("MenuItemSchema", () => {
    it("should validate complete menu item", () => {
      const validItem = {
        name: "Test Item",
        price: 9.99,
        category: "Main Course",
        description: "A delicious test item",
        is_available: true,
      };

      const result = MenuItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should validate menu item with defaults", () => {
      const minimalItem = {
        name: "Minimal Item",
        price: 5.99,
        category: "Appetizer",
      };

      const result = MenuItemSchema.safeParse(minimalItem);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(true);
      }
    });

    it("should reject menu item with invalid name", () => {
      const invalidNames = [
        { name: "Ab", price: 9.99, category: "Test" }, // Too short
        { name: "x".repeat(101), price: 9.99, category: "Test" }, // Too long
        { name: "", price: 9.99, category: "Test" }, // Empty
      ];

      invalidNames.forEach((item) => {
        const result = MenuItemSchema.safeParse(item);
        expect(result.success).toBe(false);
      });
    });

    it("should reject menu item with invalid price", () => {
      const invalidItem = {
        name: "Test Item",
        price: -5,
        category: "Main Course",
      };

      const result = MenuItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("should reject menu item with empty category", () => {
      const invalidItem = {
        name: "Test Item",
        price: 9.99,
        category: "",
      };

      const result = MenuItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("should reject menu item with too long description", () => {
      const invalidItem = {
        name: "Test Item",
        price: 9.99,
        category: "Main Course",
        description: "x".repeat(501),
      };

      const result = MenuItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("should provide detailed error messages", () => {
      const invalidItem = {
        name: "x", // Too short
        price: -1, // Invalid
        category: "", // Empty
      };

      const result = MenuItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues.some((issue) => issue.path.includes("name"))).toBe(true);
        expect(result.error.issues.some((issue) => issue.path.includes("price"))).toBe(true);
        expect(result.error.issues.some((issue) => issue.path.includes("category"))).toBe(true);
      }
    });
  });

  describe("Schema Composition", () => {
    it("should support nested schemas", () => {
      const OrderSchema = z.object({
        venue_id: VenueIdSchema,
        items: z.array(MenuItemSchema),
        customer_email: EmailSchema,
        total: PriceSchema,
      });

      const validOrder = {
        venue_id: "123e4567-e89b-12d3-a456-426614174000",
        items: [
          {
            name: "Item 1",
            price: 9.99,
            category: "Main",
          },
        ],
        customer_email: "customer@example.com",
        total: 9.99,
      };

      const result = OrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it("should support schema refinements", () => {
      const PasswordSchema = z
        .string()
        .min(8)
        .refine((val) => /[A-Z]/.test(val), "Must contain uppercase")
        .refine((val) => /[0-9]/.test(val), "Must contain number");

      expect(PasswordSchema.safeParse("Password1").success).toBe(true);
      expect(PasswordSchema.safeParse("password").success).toBe(false);
      expect(PasswordSchema.safeParse("Pass1").success).toBe(false);
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  validateData,
  getValidationErrors,
  MenuItemSchema,
  CreateOrderSchema,
  EmailSchema,
  PriceSchema,
} from "@/lib/validation/schemas";

describe("Validation Schemas", () => {
  describe("MenuItemSchema", () => {
    it("should validate correct menu item data", () => {
      const validItem = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Burger",
        description: "Delicious burger",
        price: 12.99,
        category: "Main Course",
        is_available: true,
      };

      const result = validateData(MenuItemSchema, validItem);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Burger");
      }
    });

    it("should reject invalid price", () => {
      const invalidItem = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Burger",
        price: -5,
        category: "Main Course",
      };

      const result = validateData(MenuItemSchema, invalidItem);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = getValidationErrors(result.errors);
        expect(errors.some((e) => e.field === "price")).toBe(true);
      }
    });

    it("should reject empty name", () => {
      const invalidItem = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "",
        price: 10,
        category: "Main Course",
      };

      const result = validateData(MenuItemSchema, invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe("CreateOrderSchema", () => {
    it("should validate correct order data", () => {
      const validOrder = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        items: [
          {
            menu_item_id: "650e8400-e29b-41d4-a716-446655440000",
            quantity: 2,
            price: 12.99,
          },
        ],
        total_amount: 25.98,
        payment_method: "card" as const,
      };

      const result = validateData(CreateOrderSchema, validOrder);
      expect(result.success).toBe(true);
    });

    it("should reject order with no items", () => {
      const invalidOrder = {
        venue_id: "550e8400-e29b-41d4-a716-446655440000",
        items: [],
        total_amount: 0,
        payment_method: "cash" as const,
      };

      const result = validateData(CreateOrderSchema, invalidOrder);
      expect(result.success).toBe(false);
    });
  });

  describe("EmailSchema", () => {
    it("should validate correct email", () => {
      const result = EmailSchema.safeParse("test@example.com");
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = EmailSchema.safeParse("not-an-email");
      expect(result.success).toBe(false);
    });
  });

  describe("PriceSchema", () => {
    it("should accept valid prices", () => {
      expect(PriceSchema.safeParse(0).success).toBe(true);
      expect(PriceSchema.safeParse(10.99).success).toBe(true);
      expect(PriceSchema.safeParse(1000).success).toBe(true);
    });

    it("should reject negative prices", () => {
      expect(PriceSchema.safeParse(-1).success).toBe(false);
      expect(PriceSchema.safeParse(-0.01).success).toBe(false);
    });
  });
});

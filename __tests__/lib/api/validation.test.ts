import { describe, it, expect } from "vitest";
import {
  sanitizeString,
  sanitizeHTML,
  EmailSchema,
  PhoneSchema,
  CreateOrderSchema,
  MenuItemSchema,
} from "@/lib/api/validation";

describe("Input Validation", () => {
  describe("sanitizeString", () => {
    it("should trim whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("should remove XSS characters", () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain("<");
    });

    it("should enforce max length", () => {
      const longString = "a".repeat(2000);
      expect(sanitizeString(longString, 100)).toHaveLength(100);
    });
  });

  describe("sanitizeHTML", () => {
    it("should strip HTML tags", () => {
      const input = "<p>Hello <b>World</b></p>";
      expect(sanitizeHTML(input)).toBe("Hello World");
    });

    it("should remove script tags", () => {
      const input = 'Safe text<script>alert("bad")</script>More text';
      expect(sanitizeHTML(input)).not.toContain("script");
    });

    it("should remove event handlers", () => {
      const input = '<div onclick="alert()">Click me</div>';
      expect(sanitizeHTML(input)).not.toContain("onclick");
    });
  });

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
      expect(PhoneSchema.safeParse("023").success).toBe(false); // starts with 0
      expect(PhoneSchema.safeParse("abc").success).toBe(false); // contains letters
      expect(PhoneSchema.safeParse("").success).toBe(false); // empty string
    });
  });

  describe("CreateOrderSchema", () => {
    it("should validate complete order payload", () => {
      const validOrder = {
        venue_id: "venue-test-123",
        customer_name: "John Doe",
        customer_phone: "+441234567890",
        items: [
          {
            item_name: "Burger",
            quantity: 2,
            price: 12.99,
          },
        ],
        total_amount: 25.98,
        payment_method: "CARD",
        payment_status: "PAID",
      };

      const result = CreateOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it("should reject orders with missing required fields", () => {
      const invalidOrder = {
        venue_id: "venue-test-123",
        // Missing customer_name
        items: [],
      };

      expect(CreateOrderSchema.safeParse(invalidOrder).success).toBe(false);
    });

    it("should sanitize customer name", () => {
      const order = {
        venue_id: "venue-test-123",
        customer_name: '  <script>alert("xss")</script>John  ',
        customer_phone: "+441234567890",
        items: [{ item_name: "Test", quantity: 1, price: 10 }],
        total_amount: 10,
        payment_method: "CASH",
        payment_status: "PAID",
      };

      const result = CreateOrderSchema.parse(order);
      expect(result.customer_name).not.toContain("<");
      expect(result.customer_name).not.toContain(">");
    });
  });

  describe("MenuItemSchema", () => {
    it("should validate menu items", () => {
      const item = {
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
        name: "Test Item",
        price: -5.99,
      };

      expect(MenuItemSchema.safeParse(item).success).toBe(false);
    });
  });
});

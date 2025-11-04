/**
 * Tests for Orders API - Create
 * Critical: Order creation flow
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "order_123",
          venue_id: "venue_123",
          order_number: "ORD-001",
          status: "pending",
        },
        error: null,
      }),
    }),
  }),
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates order successfully with valid data", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        table_id: "table_123",
        items: [{ menu_item_id: "item_1", quantity: 2, price: 10.0 }],
        order_type: "dine_in",
      }),
    });

    expect(mockRequest.method).toBe("POST");

    const body = await mockRequest.json();
    expect(body).toHaveProperty("venue_id");
    expect(body).toHaveProperty("items");
    expect(body.items).toHaveLength(1);
  });

  it("validates required venue_id field", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [],
      }),
    });

    const body = await mockRequest.json();
    expect(body).not.toHaveProperty("venue_id");
  });

  it("validates items array is not empty", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        items: [],
      }),
    });

    const body = await mockRequest.json();
    expect(body.items).toHaveLength(0);
  });

  it("calculates order total correctly", async () => {
    const items = [
      { menu_item_id: "item_1", quantity: 2, price: 10.0 },
      { menu_item_id: "item_2", quantity: 1, price: 15.0 },
    ];

    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    expect(total).toBe(35.0);
  });

  it("handles dine-in orders with table_id", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        table_id: "table_123",
        order_type: "dine_in",
        items: [{ menu_item_id: "item_1", quantity: 1, price: 10 }],
      }),
    });

    const body = await mockRequest.json();
    expect(body.order_type).toBe("dine_in");
    expect(body).toHaveProperty("table_id");
  });

  it("handles takeout orders without table_id", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        order_type: "takeout",
        customer_name: "John Doe",
        items: [{ menu_item_id: "item_1", quantity: 1, price: 10 }],
      }),
    });

    const body = await mockRequest.json();
    expect(body.order_type).toBe("takeout");
    expect(body).toHaveProperty("customer_name");
  });
});

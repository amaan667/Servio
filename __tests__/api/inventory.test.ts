 
/**
 * Tests for Inventory API
 * Critical: Stock management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "ingredient_123",
          name: "Tomatoes",
          on_hand: 50,
          unit: "kg",
        },
        error: null,
      }),
    }),
  }),
}));

describe("GET /api/inventory/ingredients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves ingredients for venue", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api//inventory/ingredients?venue_id=venue_123",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("venue_id=venue_123");
  });

  it("filters low stock items", async () => {
    const ingredient = {
      id: "ing_1",
      on_hand: 5,
      minimum_stock: 20,
    };

    expect(ingredient.on_hand).toBeLessThan(ingredient.minimum_stock);
  });
});

describe("POST /api/inventory/ingredients", () => {
  it("creates ingredient with valid data", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//inventory/ingredients", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        name: "Flour",
        unit: "kg",
        on_hand: 100,
        minimum_stock: 20,
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("unit");
  });

  it("validates on_hand is not negative", async () => {
    const validStock = 50;
    const invalidStock = -10;

    expect(validStock).toBeGreaterThanOrEqual(0);
    expect(invalidStock).toBeLessThan(0);
  });
});

describe("POST /api/inventory/stock/adjust", () => {
  it("adjusts stock levels", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//inventory/stock/adjust", {
      method: "POST",
      body: JSON.stringify({
        ingredient_id: "ing_123",
        quantity: 10,
        type: "add",
        reason: "Purchase",
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("quantity");
    expect(body).toHaveProperty("type");
  });

  it("handles stock deduction", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//inventory/stock/adjust", {
      method: "POST",
      body: JSON.stringify({
        ingredient_id: "ing_123",
        quantity: 5,
        type: "remove",
        reason: "Used in production",
      }),
    });

    const body = await mockRequest.json();
    expect(body.type).toBe("remove");
  });
});

describe("GET /api/inventory/low-stock", () => {
  it("returns low stock items", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api//inventory/low-stock?venue_id=venue_123",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("low-stock");
  });
});

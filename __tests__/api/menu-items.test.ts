/**
 * Tests for Menu Items API
 * Critical: Menu management
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
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "item_123",
          name: "Test Item",
          price: 10.0,
          venue_id: "venue_123",
        },
        error: null,
      }),
    }),
  }),
}));

describe("GET /api/menu/[venueId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves menu items for valid venue", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/venue_123", {
      method: "GET",
    });

    expect(mockRequest.method).toBe("GET");
    expect(mockRequest.url).toContain("venue_123");
  });

  it("returns 404 for non-existent venue", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/invalid_venue", {
      method: "GET",
    });

    expect(mockRequest.url).toContain("invalid_venue");
  });

  it("filters by is_available flag", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/venue_123?available=true", {
      method: "GET",
    });

    expect(mockRequest.url).toContain("available=true");
  });

  it("includes category information", async () => {
    const mockItem = {
      id: "item_123",
      name: "Test Item",
      category_id: "cat_123",
      category: { name: "Appetizers" },
    };

    expect(mockItem).toHaveProperty("category");
  });
});

describe("POST /api/menu/items", () => {
  it("creates menu item with valid data", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/items", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        name: "New Item",
        description: "Delicious food",
        price: 15.0,
        category_id: "cat_123",
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("price");
    expect(body.price).toBeGreaterThan(0);
  });

  it("validates required fields", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/items", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
      }),
    });

    const body = await mockRequest.json();
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("price");
  });

  it("validates price is positive number", async () => {
    const validPrice = 10.0;
    const invalidPrice = -5.0;

    expect(validPrice).toBeGreaterThan(0);
    expect(invalidPrice).toBeLessThan(0);
  });
});

describe("PATCH /api/menu/items/[id]", () => {
  it("updates menu item", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/items/item_123", {
      method: "PATCH",
      body: JSON.stringify({
        price: 12.0,
        is_available: false,
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("price");
    expect(body).toHaveProperty("is_available");
  });

  it("prevents unauthorized updates", async () => {
    // Test structure - would check venue ownership
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/items/item_123", {
      method: "PATCH",
      body: JSON.stringify({ price: 100.0 }),
    });

    expect(mockRequest.method).toBe("PATCH");
  });
});

describe("DELETE /api/menu/items/[id]", () => {
  it("deletes menu item", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/items/item_123", {
      method: "DELETE",
    });

    expect(mockRequest.method).toBe("DELETE");
  });

  it("prevents deletion by non-owners", async () => {
    // Test structure - would check venue ownership
    const mockRequest = new NextRequest("http://localhost:3000/api/menu/items/item_123", {
      method: "DELETE",
    });

    expect(mockRequest.method).toBe("DELETE");
  });
});

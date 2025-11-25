import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/orders/route";

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
    insert: vi.fn(() => Promise.resolve({ data: { id: "order-123" }, error: null })),
    update: vi.fn(() => Promise.resolve({ data: { /* Empty */ }, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: { /* Empty */ }, error: null })),
  })),
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-123" } }, error: null })),
  },
};

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Orders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/orders", () => {
    it("should create a new order", async () => {
      const requestBody = {
        venue_id: "venue-123",
        table_id: "table-123",
        items: [{ menu_item_id: "item-1", quantity: 2, price: 10.99 }],
        total_amount: 21.98,
        customer_name: "John Doe",
      };

      const request = new NextRequest("http://localhost:3000/api//orders", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order).toBeDefined();
    });

    it("should return 400 for invalid order data", async () => {
      const requestBody = {
        // Missing required fields
        items: [],
      };

      const request = new NextRequest("http://localhost:3000/api//orders", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should return 401 for unauthorized requests", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Unauthorized" },
      });

      const request = new NextRequest("http://localhost:3000/api//orders", {
        method: "POST",
        body: JSON.stringify({ venue_id: "venue-123" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/orders", () => {
    it("should return orders for a venue", async () => {
      const mockOrders = [
        {
          id: "order-1",
          venue_id: "venue-123",
          status: "pending",
          total_amount: 25.99,
          created_at: "2024-01-01T10:00:00Z",
        },
      ];

      mockSupabase.from().select().eq().order().limit.mockResolvedValueOnce({
        data: mockOrders,
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api//orders?venue_id=venue-123", {
        method: "GET",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toEqual(mockOrders);
    });

    it("should handle database errors", async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .order()
        .limit.mockResolvedValueOnce({
          data: null,
          error: { message: "Database connection failed" },
        });

      const request = new NextRequest("http://localhost:3000/api//orders?venue_id=venue-123", {
        method: "GET",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });
});

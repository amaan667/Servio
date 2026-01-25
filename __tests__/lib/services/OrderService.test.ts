/**
 * OrderService Tests
 * Tests for critical order service methods
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "@/lib/services/OrderService";
import { createSupabaseClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/monitoring/error-tracking", () => ({
  trackOrderError: vi.fn(),
}));

describe("OrderService", () => {
  let orderService: OrderService;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    orderService = new OrderService();
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(),
              })),
              single: vi.fn(),
            })),
            in: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  limit: vi.fn(),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(),
              })),
            })),
          })),
        })),
      })),
      rpc: vi.fn(),
    };
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createSupabaseClient>);
  });

  describe("getOrders", () => {
    it("should fetch orders with filters", async () => {
      const mockOrders = [
        { id: "1", venue_id: "venue-1", order_status: "PLACED" },
        { id: "2", venue_id: "venue-1", order_status: "COMPLETED" },
      ];

      const queryBuilder = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(queryBuilder),
          }),
        }),
      } as unknown);

      const result = await orderService.getOrders("venue-1", { status: "PLACED", limit: 10 });

      expect(result).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: new Error("Database error") }),
            }),
          }),
        }),
      } as unknown);

      await expect(orderService.getOrders("venue-1")).rejects.toThrow();
    });
  });

  describe("createOrder", () => {
    it("should create order successfully", async () => {
      const mockOrder = {
        id: "order-1",
        venue_id: "venue-1",
        customer_name: "Test Customer",
        total_amount: 25.50,
      };

      mockSupabase.rpc.mockResolvedValue({
        data: mockOrder,
        error: null,
      });

      const result = await orderService.createOrder("venue-1", {
        customer_name: "Test Customer",
        customer_phone: "+1234567890",
        items: [{ item_name: "Burger", quantity: 1, price: 25.50 }],
        total_amount: 25.50,
      });

      expect(result).toBeDefined();
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "create_order_with_session_v2",
        expect.objectContaining({
          p_venue_id: "venue-1",
          p_customer_name: "Test Customer",
        })
      );
    });

    it("should handle RPC errors with fallback", async () => {
      const mockOrder = { id: "order-1", venue_id: "venue-1" };

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error("RPC failed"),
      });

      const insertBuilder = {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockOrder,
              error: null,
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(insertBuilder as unknown);

      const result = await orderService.createOrder("venue-1", {
        customer_name: "Test",
        customer_phone: "+1234567890",
        items: [],
        total_amount: 10,
      });

      expect(result).toBeDefined();
    });
  });

  describe("markServed", () => {
    it("should mark order as served", async () => {
      const mockOrder = { id: "order-1", service_status: "SERVED" };

      mockSupabase.rpc.mockResolvedValue({
        data: mockOrder,
        error: null,
      });

      const updateBuilder = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(updateBuilder as unknown);

      const result = await orderService.markServed("order-1", "venue-1");

      expect(result).toBeDefined();
      expect(mockSupabase.rpc).toHaveBeenCalledWith("orders_set_served", {
        p_order_id: "order-1",
        p_venue_id: "venue-1",
      });
    });
  });

  describe("updatePaymentStatus", () => {
    it("should update payment status", async () => {
      const mockOrder = { id: "order-1", payment_status: "PAID" };

      const updateBuilder = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockOrder,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      mockSupabase.from.mockReturnValue(updateBuilder as unknown);

      const result = await orderService.updatePaymentStatus("order-1", "venue-1", "PAID");

      expect(result).toBeDefined();
      expect(result.payment_status).toBe("PAID");
    });
  });
});

/**
 * @fileoverview Unit tests for OrderService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { OrderService } from "@/lib/services/OrderService";
import { createSupabaseClient } from "@/lib/supabase";

// Mock Supabase client
vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

describe("OrderService", () => {
  let orderService: OrderService;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    orderService = new OrderService();
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      limit: vi.fn(() => mockSupabase),
      gte: vi.fn(() => mockSupabase),
      lte: vi.fn(() => mockSupabase),
      in: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
      maybeSingle: vi.fn(() => mockSupabase),
      rpc: vi.fn(() => mockSupabase),
    };
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrders", () => {
    it("should return orders for a venue", async () => {
      const mockOrders = [
        { id: "1", venue_id: "venue-1", order_status: "PLACED" },
        { id: "2", venue_id: "venue-1", order_status: "COMPLETED" },
      ];

      mockSupabase.single.mockResolvedValue({ data: mockOrders, error: null });

      const orders = await orderService.getOrders("venue-1");

      expect(orders).toEqual(mockOrders);
      expect(mockSupabase.from).toHaveBeenCalledWith("orders");
      expect(mockSupabase.eq).toHaveBeenCalledWith("venue_id", "venue-1");
    });

    it("should apply status filter when provided", async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null });

      await orderService.getOrders("venue-1", { status: "PLACED" });

      expect(mockSupabase.eq).toHaveBeenCalledWith("order_status", "PLACED");
    });

    it("should apply date range filters when provided", async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null });

      const startDate = "2024-01-01T00:00:00Z";
      const endDate = "2024-01-31T23:59:59Z";

      await orderService.getOrders("venue-1", { startDate, endDate });

      expect(mockSupabase.gte).toHaveBeenCalledWith("created_at", startDate);
      expect(mockSupabase.lte).toHaveBeenCalledWith("created_at", endDate);
    });

    it("should throw error when Supabase query fails", async () => {
      const error = new Error("Database error");
      mockSupabase.single.mockResolvedValue({ data: null, error });

      await expect(orderService.getOrders("venue-1")).rejects.toThrow("Database error");
    });
  });

  describe("getOrder", () => {
    it("should return a single order by ID", async () => {
      const mockOrder = { id: "1", venue_id: "venue-1", order_status: "PLACED" };
      mockSupabase.single.mockResolvedValue({ data: mockOrder, error: null });

      const order = await orderService.getOrder("1", "venue-1");

      expect(order).toEqual(mockOrder);
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "1");
      expect(mockSupabase.eq).toHaveBeenCalledWith("venue_id", "venue-1");
    });

    it("should return null when order not found", async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const order = await orderService.getOrder("nonexistent", "venue-1");

      expect(order).toBeNull();
    });
  });

  describe("createOrder", () => {
    it("should create a new order successfully", async () => {
      const orderData = {
        customer_name: "John Doe",
        customer_phone: "+1234567890",
        items: [{ menu_item_id: "item-1", quantity: 2, price: 10 }],
        total_amount: 20,
        source: "qr" as const,
      };

      const mockCreatedOrder = {
        id: "new-order-id",
        ...orderData,
        venue_id: "venue-1",
        order_status: "PLACED",
        payment_status: "UNPAID",
      };

      mockSupabase.select.mockResolvedValue({
        data: [mockCreatedOrder],
        error: null,
      });

      const order = await orderService.createOrder("venue-1", orderData);

      expect(order).toEqual(mockCreatedOrder);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should set correct fulfillment_type based on source", async () => {
      const orderData = {
        customer_name: "John Doe",
        customer_phone: "+1234567890",
        items: [],
        total_amount: 0,
        source: "counter" as const,
      };

      mockSupabase.select.mockResolvedValue({
        data: [{ id: "new-order-id", fulfillment_type: "counter" }],
        error: null,
      });

      await orderService.createOrder("venue-1", orderData);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.fulfillment_type).toBe("counter");
    });

    it("should throw error when creation fails", async () => {
      const error = { message: "Failed to create order" };
      mockSupabase.select.mockResolvedValue({ data: null, error });

      await expect(
        orderService.createOrder("venue-1", {
          customer_name: "John",
          customer_phone: "+1234567890",
          items: [],
          total_amount: 0,
        })
      ).rejects.toThrow("Failed to create order");
    });
  });

  describe("updateOrderStatus", () => {
    it("should update order status successfully", async () => {
      const mockUpdatedOrder = {
        id: "1",
        venue_id: "venue-1",
        order_status: "COMPLETED",
      };

      mockSupabase.single.mockResolvedValue({ data: mockUpdatedOrder, error: null });

      const order = await orderService.updateOrderStatus("1", "venue-1", "COMPLETED");

      expect(order).toEqual(mockUpdatedOrder);
      expect(mockSupabase.update).toHaveBeenCalledWith({ order_status: "COMPLETED" });
    });
  });

  describe("markServed", () => {
    it("should mark order as served using RPC", async () => {
      const mockOrder = { id: "1", order_status: "SERVED" };
      mockSupabase.rpc.mockResolvedValue({ data: mockOrder, error: null });

      const order = await orderService.markServed("1", "venue-1");

      expect(order).toEqual(mockOrder);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("orders_set_served", {
        p_order_id: "1",
        p_venue_id: "venue-1",
      });
    });
  });

  describe("completeOrder", () => {
    it("should complete order using RPC", async () => {
      const mockOrder = { id: "1", order_status: "COMPLETED", table_id: "table-1" };
      mockSupabase.rpc.mockResolvedValue({ data: mockOrder, error: null });

      const order = await orderService.completeOrder("1", "venue-1");

      expect(order).toEqual(mockOrder);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("orders_complete", {
        p_order_id: "1",
        p_venue_id: "venue-1",
        p_forced: false,
        p_forced_by: null,
        p_forced_reason: null,
      });
    });

    it("should support forced completion", async () => {
      const mockOrder = { id: "1", order_status: "COMPLETED" };
      mockSupabase.rpc.mockResolvedValue({ data: mockOrder, error: null });

      await orderService.completeOrder("1", "venue-1", {
        forced: true,
        userId: "user-1",
        forcedReason: "Customer left",
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("orders_complete", {
        p_order_id: "1",
        p_venue_id: "venue-1",
        p_forced: true,
        p_forced_by: "user-1",
        p_forced_reason: "Customer left",
      });
    });
  });

  describe("cancelOrder", () => {
    it("should cancel order by updating status", async () => {
      const mockOrder = { id: "1", order_status: "CANCELLED" };
      mockSupabase.single.mockResolvedValue({ data: mockOrder, error: null });

      const order = await orderService.cancelOrder("1", "venue-1");

      expect(order).toEqual(mockOrder);
      expect(mockSupabase.update).toHaveBeenCalledWith({ order_status: "CANCELLED" });
    });
  });

  describe("bulkCompleteOrders", () => {
    it("should complete multiple orders", async () => {
      const mockOrders = [
        { id: "1", order_status: "PLACED", table_id: "table-1" },
        { id: "2", order_status: "PLACED", table_id: "table-2" },
      ];

      mockSupabase.select.mockResolvedValue({ data: mockOrders, error: null });
      mockSupabase.rpc.mockResolvedValue({ data: mockOrders[0], error: null });

      const count = await orderService.bulkCompleteOrders(["1", "2"], "venue-1");

      expect(count).toBe(2);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it("should skip already completed orders", async () => {
      const mockOrders = [
        { id: "1", order_status: "COMPLETED", table_id: "table-1" },
        { id: "2", order_status: "PLACED", table_id: "table-2" },
      ];

      mockSupabase.select.mockResolvedValue({ data: mockOrders, error: null });
      mockSupabase.rpc.mockResolvedValue({ data: mockOrders[1], error: null });

      const count = await orderService.bulkCompleteOrders(["1", "2"], "venue-1");

      expect(count).toBe(1);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe("getRecentOrders", () => {
    it("should return orders from last 24 hours by default", async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null });

      await orderService.getRecentOrders("venue-1");

      expect(mockSupabase.gte).toHaveBeenCalled();
    });

    it("should return orders from specified hours", async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null });

      await orderService.getRecentOrders("venue-1", 48);

      expect(mockSupabase.gte).toHaveBeenCalled();
    });
  });
});

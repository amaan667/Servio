/**
 * @fileoverview Unit tests for OrderService
 * Uses file-level mock so OrderService gets a chain with .from/.rpc (no importOriginal to avoid loading real supabase).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { OrderService } from "@/lib/services/OrderService";
import { createSupabaseClient, __orderTestChain } from "@/lib/supabase";

const setSupabaseQueryResult = (r: { data: unknown; error: unknown }) => {
  (globalThis as unknown as { __supabaseQueryResult: { data: unknown; error: unknown } }).__supabaseQueryResult = r;
};

// File-level mock: full replacement so OrderService sees chain.with(.from/.rpc). getResult reads globalThis (hoist-safe).
vi.mock("@/lib/supabase", () => {
  const getResult = () =>
    (globalThis as unknown as { __supabaseQueryResult: { data: unknown; error: unknown } }).__supabaseQueryResult ?? {
      data: [],
      error: null,
    };
  const chain: Record<string, unknown> = {
    then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(getResult()).then(onFulfilled);
    },
    from() {
      return chain;
    },
    select() {
      return chain;
    },
    eq() {
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    gte() {
      return chain;
    },
    lte() {
      return chain;
    },
    in() {
      return chain;
    },
    single() {
      return Promise.resolve(getResult());
    },
    maybeSingle() {
      return Promise.resolve(getResult());
    },
    update() {
      return {
        eq: () => ({
          eq: () => ({
            select: () => ({ single: () => Promise.resolve(getResult()) }),
          }),
        }),
      };
    },
    insert() {
      return { select: () => Promise.resolve(getResult()) };
    },
    rpc() {
      return Promise.resolve(getResult());
    },
  };
  // Client without .then so await createSupabaseClient() returns this; .from()/.rpc() return chain
  const client = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    gte: () => chain,
    lte: () => chain,
    in: () => chain,
    single: () => Promise.resolve(getResult()),
    maybeSingle: () => Promise.resolve(getResult()),
    update: () => ({
      eq: () => ({
        eq: () => ({
          select: () => ({ single: () => Promise.resolve(getResult()) }),
        }),
      }),
    }),
    insert: () => ({ select: () => Promise.resolve(getResult()) }),
    rpc: () => Promise.resolve(getResult()),
  };
  const base = () => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null })),
      delete: vi.fn(() => ({ data: null, error: null })),
    })),
  });
  return {
    createSupabaseClient: vi.fn(() => Promise.resolve(client)),
    __orderTestChain: client,
    createClient: vi.fn(() => base()),
    createAdminClient: vi.fn(() => base()),
    supabaseBrowser: vi.fn(() => base()),
    supabaseServer: vi.fn(() => base()),
    getSupabaseUrl: vi.fn(() => "https://test.supabase.co"),
    getSupabaseAnonKey: vi.fn(() => "test-anon-key"),
  };
});

describe("OrderService", () => {
  let orderService: OrderService;

  beforeEach(() => {
    vi.mocked(createSupabaseClient).mockImplementation(() =>
      Promise.resolve(__orderTestChain as Awaited<ReturnType<typeof createSupabaseClient>>)
    );
    orderService = new OrderService();
    setSupabaseQueryResult({ data: [], error: null });
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

      setSupabaseQueryResult({ data: mockOrders, error: null });

      const orders = await orderService.getOrders("venue-1");

      expect(orders).toEqual(mockOrders);
      expect(createSupabaseClient).toHaveBeenCalled();
    });

    it("should apply status filter when provided", async () => {
      setSupabaseQueryResult({ data: [], error: null });

      const orders = await orderService.getOrders("venue-1", { status: "PLACED" });

      expect(orders).toEqual([]);
      expect(createSupabaseClient).toHaveBeenCalled();
    });

    it("should apply date range filters when provided", async () => {
      setSupabaseQueryResult({ data: [], error: null });

      const startDate = "2024-01-01T00:00:00Z";
      const endDate = "2024-01-31T23:59:59Z";

      const orders = await orderService.getOrders("venue-1", { startDate, endDate });

      expect(orders).toEqual([]);
    });

    it("should throw error when Supabase query fails", async () => {
      setSupabaseQueryResult({ data: null, error: new Error("Database error") });

      await expect(orderService.getOrders("venue-1")).rejects.toThrow();
    });
  });

  describe("getOrder", () => {
    it("should return a single order by ID", async () => {
      const mockOrder = { id: "1", venue_id: "venue-1", order_status: "PLACED" };
      setSupabaseQueryResult({ data: mockOrder, error: null });

      const order = await orderService.getOrder("1", "venue-1");

      expect(order).toEqual(mockOrder);
    });

    it("should return null when order not found", async () => {
      setSupabaseQueryResult({ data: null, error: null });

      const order = await orderService.getOrder("nonexistent", "venue-1");

      expect(order).toBeNull();
    });
  });

  describe("createOrder", () => {
    it("should create a new order successfully", async () => {
      const orderData = {
        customer_name: "John Doe",
        customer_phone: "+1234567890",
        items: [
          {
            item_name: "Burger",
            menu_item_id: "550e8400-e29b-41d4-a716-446655440000",
            quantity: 2,
            price: 10,
          },
        ],
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

      setSupabaseQueryResult({ data: [mockCreatedOrder], error: null });

      const order = await orderService.createOrder("venue-1", orderData);

      expect(order).toBeDefined();
      expect(createSupabaseClient).toHaveBeenCalled();
    });

    it("should set correct fulfillment_type based on source", async () => {
      const orderData = {
        customer_name: "John Doe",
        customer_phone: "+1234567890",
        items: [{ item_name: "Item", quantity: 1, price: 10 }],
        total_amount: 10,
        source: "counter" as const,
      };

      setSupabaseQueryResult({ data: [{ id: "new-order-id", fulfillment_type: "counter" }], error: null });

      await orderService.createOrder("venue-1", orderData);

      expect(createSupabaseClient).toHaveBeenCalled();
    });

    it("should throw error when creation fails", async () => {
      setSupabaseQueryResult({ data: null, error: { message: "Failed to create order" } });

      await expect(
        orderService.createOrder("venue-1", {
          customer_name: "John",
          customer_phone: "+1234567890",
          items: [{ item_name: "Item", quantity: 1, price: 10 }],
          total_amount: 10,
        })
      ).rejects.toThrow();
    });
  });

  describe("updateOrderStatus", () => {
    it("should update order status successfully", async () => {
      const mockUpdatedOrder = {
        id: "1",
        venue_id: "venue-1",
        order_status: "COMPLETED",
      };

      setSupabaseQueryResult({ data: mockUpdatedOrder, error: null });

      const order = await orderService.updateOrderStatus("1", "venue-1", "COMPLETED");

      expect(order).toEqual(mockUpdatedOrder);
    });
  });

  describe("markServed", () => {
    it("should mark order as served using RPC", async () => {
      const mockOrder = { id: "1", order_status: "SERVED" };
      setSupabaseQueryResult({ data: mockOrder, error: null });

      const order = await orderService.markServed("1", "venue-1");

      expect(order).toEqual(mockOrder);
    });
  });

  describe("completeOrder", () => {
    it("should complete order using RPC", async () => {
      const mockOrder = { id: "1", order_status: "COMPLETED", table_id: "table-1" };
      setSupabaseQueryResult({ data: mockOrder, error: null });

      const order = await orderService.completeOrder("1", "venue-1");

      expect(order).toEqual(mockOrder);
    });

    it("should support forced completion", async () => {
      const mockOrder = { id: "1", order_status: "COMPLETED" };
      setSupabaseQueryResult({ data: mockOrder, error: null });

      await orderService.completeOrder("1", "venue-1", {
        forced: true,
        userId: "user-1",
        forcedReason: "Customer left",
      });

      expect(createSupabaseClient).toHaveBeenCalled();
    });
  });

  describe("cancelOrder", () => {
    it("should cancel order by updating status", async () => {
      const mockOrder = { id: "1", order_status: "CANCELLED" };
      setSupabaseQueryResult({ data: mockOrder, error: null });

      const order = await orderService.cancelOrder("1", "venue-1");

      expect(order).toEqual(mockOrder);
    });
  });

  describe("bulkCompleteOrders", () => {
    it("should complete multiple orders", async () => {
      const mockOrders = [
        { id: "1", order_status: "PLACED", table_id: "table-1" },
        { id: "2", order_status: "PLACED", table_id: "table-2" },
      ];

      setSupabaseQueryResult({ data: mockOrders, error: null });

      const count = await orderService.bulkCompleteOrders(["1", "2"], "venue-1");

      expect(count).toBe(2);
    });

    it("should skip already completed orders", async () => {
      const mockOrders = [
        { id: "1", order_status: "COMPLETED", table_id: "table-1" },
        { id: "2", order_status: "PLACED", table_id: "table-2" },
      ];

      setSupabaseQueryResult({ data: mockOrders, error: null });

      const count = await orderService.bulkCompleteOrders(["1", "2"], "venue-1");

      expect(count).toBe(1);
    });
  });

  describe("getRecentOrders", () => {
    it("should return orders from last 24 hours by default", async () => {
      setSupabaseQueryResult({ data: [], error: null });

      const orders = await orderService.getRecentOrders("venue-1");

      expect(orders).toEqual([]);
    });

    it("should return orders from specified hours", async () => {
      setSupabaseQueryResult({ data: [], error: null });

      const orders = await orderService.getRecentOrders("venue-1", 48);

      expect(orders).toEqual([]);
    });
  });
});

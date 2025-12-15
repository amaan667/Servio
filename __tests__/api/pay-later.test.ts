/**
 * Pay Later acceptance tests
 * - Pay Later marking
 * - Serve gating
 * - Payment update and completion
 * - Idempotent completion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../helpers/api-test-helpers";
import { POST as payLaterPOST } from "@/app/api/pay/later/route";
import { POST as completePOST } from "@/app/api/orders/complete/route";
import { POST as servePOST } from "@/app/api/orders/serve/route";
import { POST as updatePaymentStatusPOST } from "@/app/api/orders/update-payment-status/route";

// Simple in-memory order store to emulate DB behaviour for flow tests
const mockOrders: Record<
  string,
  {
    id: string;
    venue_id: string;
    payment_method: string;
    payment_status: string;
    order_status: string;
  }
> = {};

const resetMockOrders = () => {
  for (const key of Object.keys(mockOrders)) {
    delete mockOrders[key];
  }
};

// Mock Supabase behaviour used by pay-later + lifecycle routes
vi.mock("@/lib/supabase", () => {
  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, value: string) => {
                if (col === "id") {
                  const order = mockOrders[value];
                  return {
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: order || null, error: null })),
                    })),
                    single: vi.fn(async () => ({ data: order || null, error: null })),
                  };
                }
                if (col === "venue_id") {
                  const order = Object.values(mockOrders).find((o) => o.venue_id === value);
                  return {
                    single: vi.fn(async () => ({ data: order || null, error: null })),
                  };
                }
                return {
                  single: vi.fn(async () => ({ data: null, error: null })),
                };
              }),
            })),
            update: vi.fn((updateData: Record<string, unknown>) => ({
              eq: vi.fn((col: string, value: string) => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => {
                      const order = mockOrders[value];
                      if (order) {
                        mockOrders[value] = {
                          ...order,
                          payment_status:
                            (updateData.payment_status as string) || order.payment_status,
                          payment_method:
                            (updateData.payment_method as string) || order.payment_method,
                          order_status: (updateData.order_status as string) || order.order_status,
                        };
                      }
                      return { data: mockOrders[value] || null, error: null };
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "table_sessions" || table === "table_runtime_state") {
          // We don't assert table state here; just pretend success
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }),
      rpc: vi.fn((fnName: string, args: Record<string, unknown>) => {
        if (fnName === "orders_complete") {
          const id = args.p_order_id as string;
          const order = mockOrders[id];
          if (!order || order.payment_status !== "PAID") {
            return Promise.resolve({
              data: null,
              error: { message: "Order not eligible for completion" },
            });
          }
          mockOrders[id] = { ...order, order_status: "COMPLETED" };
          return Promise.resolve({ data: [mockOrders[id]], error: null });
        }
        if (fnName === "orders_set_served") {
          const id = args.p_order_id as string;
          const order = mockOrders[id];
          if (!order) {
            return Promise.resolve({ data: null, error: { message: "Order not found" } });
          }
          mockOrders[id] = { ...order, order_status: "SERVED" };
          return Promise.resolve({ data: [mockOrders[id]], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    })),
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
    })),
  };
});

describe("Pay Later API & lifecycle", () => {
  beforeEach(() => {
    resetMockOrders();
  });

  describe("POST /api/pay/later", () => {
    it("marks an existing order as PAY_LATER + UNPAID", async () => {
      const orderId = "order-123";
      mockOrders[orderId] = {
        id: orderId,
        venue_id: "venue-1",
        payment_method: "PAY_NOW",
        payment_status: "UNPAID",
        order_status: "PLACED",
      };

      const body = {
        order_id: orderId,
        venue_id: "venue-1",
        sessionId: "session-abc",
      };
      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/pay/later",
        JSON.stringify(body),
        { "Content-Type": "application/json" }
      );

      const response = await payLaterPOST(request);
      expect(response.status).toBe(200);
      const updated = mockOrders[orderId];
      expect(updated.payment_method).toBe("PAY_LATER");
      expect(updated.payment_status).toBe("UNPAID");
    });
  });

  describe("End-to-end Pay Later lifecycle", () => {
    it("blocks completion until payment is PAID and allows completion afterwards", async () => {
      const orderId = "order-flow-1";
      const venueId = "venue-xyz";

      // Seed an order as PAY_LATER, UNPAID, IN_PREP (kitchen started)
      mockOrders[orderId] = {
        id: orderId,
        venue_id: venueId,
        payment_method: "PAY_LATER",
        payment_status: "UNPAID",
        order_status: "IN_PREP",
      };

      // 1) Staff marks order as served (kitchen finished)
      const serveReq = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/serve",
        JSON.stringify({ orderId }),
        { "Content-Type": "application/json" }
      );
      const serveRes = await servePOST(serveReq as unknown as Request);
      expect(serveRes.status).toBe(200);
      expect(mockOrders[orderId].order_status).toBe("SERVED");

      // 2) Try to complete while UNPAID → should be rejected by orders_complete RPC
      const completeReqUnpaid = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/complete",
        JSON.stringify({ orderId }),
        { "Content-Type": "application/json" }
      );
      const completeResUnpaid = await completePOST(completeReqUnpaid as unknown as Request);
      expect(completeResUnpaid.status).toBe(400);
      // Status should remain SERVED, not COMPLETED
      expect(mockOrders[orderId].order_status).toBe("SERVED");

      // 3) Simulate Stripe / staff payment: mark as PAID
      const paymentReq = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/update-payment-status",
        JSON.stringify({ orderId, paymentStatus: "PAID", paymentMethod: "PAY_LATER" }),
        { "Content-Type": "application/json" }
      );
      const paymentRes = await updatePaymentStatusPOST(paymentReq as unknown as Request);
      expect(paymentRes.status).toBe(200);
      expect(mockOrders[orderId].payment_status).toBe("PAID");

      // 4) Now completion should succeed and set order_status = COMPLETED
      const completeReqPaid = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/complete",
        JSON.stringify({ orderId }),
        { "Content-Type": "application/json" }
      );
      const completeResPaid = await completePOST(completeReqPaid as unknown as Request);
      expect(completeResPaid.status).toBe(200);
      expect(mockOrders[orderId].order_status).toBe("COMPLETED");
    });

    it("is idempotent when completion is called twice after payment", async () => {
      const orderId = "order-flow-2";
      const venueId = "venue-xyz";

      mockOrders[orderId] = {
        id: orderId,
        venue_id: venueId,
        payment_method: "PAY_LATER",
        payment_status: "PAID",
        order_status: "SERVED",
      };

      const completeReq1 = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/complete",
        JSON.stringify({ orderId }),
        { "Content-Type": "application/json" }
      );
      const res1 = await completePOST(completeReq1 as unknown as Request);
      expect(res1.status).toBe(200);
      expect(mockOrders[orderId].order_status).toBe("COMPLETED");

      // Second call should not break or change state further
      const completeReq2 = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/complete",
        JSON.stringify({ orderId }),
        { "Content-Type": "application/json" }
      );
      const res2 = await completePOST(completeReq2 as unknown as Request);
      // Either 200 or 400 depending on RPC logic, but status must stay COMPLETED
      expect([200, 400]).toContain(res2.status);
      expect(mockOrders[orderId].order_status).toBe("COMPLETED");
    });
  });
});

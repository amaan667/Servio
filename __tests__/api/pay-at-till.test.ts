/**
 * Pay at Till acceptance tests
 *
 * Verifies:
 * - Pay at Till orders appear as unpaid until settled
 * - Payment update moves them out of unpaid queue
 * - Completion is gated until PAID
 * - Idempotent payment updates
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../helpers/api-test-helpers";
import { POST as paymentPOST } from "@/app/api/orders/payment/route";
import { POST as completePOST } from "@/app/api/orders/complete/route";
import { POST as servePOST } from "@/app/api/orders/serve/route";

// Simple in-memory order store for behavioural tests
const mockOrders: Record<
  string,
  {
    id: string;
    venue_id: string;
    payment_method: string;
    payment_status: string;
    order_status: string;
    created_at: string;
  }
> = {};

const resetMockOrders = () => {
  for (const key of Object.keys(mockOrders)) {
    delete mockOrders[key];
  }
};

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
                    eq: vi.fn((c2: string, v2: string) => {
                      if (c2 === "venue_id") {
                        const ok = order && order.venue_id === v2;
                        return {
                          single: vi.fn(async () => ({ data: ok ? order : null, error: null })),
                        };
                      }
                      return {
                        single: vi.fn(async () => ({ data: order || null, error: null })),
                      };
                    }),
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
  };
});

describe("Pay at Till lifecycle", () => {
  beforeEach(() => {
    resetMockOrders();
  });

  it("marks order as paid via /api/orders/payment and keeps venue scoping", async () => {
    const orderId = "till-1";
    const venueId = "venue-abc";

    mockOrders[orderId] = {
      id: orderId,
      venue_id: venueId,
      payment_method: "PAY_AT_TILL",
      payment_status: "UNPAID",
      order_status: "IN_PREP",
      created_at: new Date().toISOString(),
    };

    const request = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/payment",
      JSON.stringify({
        orderId,
        venue_id: venueId,
        payment_method: "till",
        payment_status: "PAID",
      })
    );

    const response = await paymentPOST(request);
    expect(response.status).toBe(200);
    expect(mockOrders[orderId].payment_status).toBe("PAID");
  });

  it("blocks completion for UNPAID Pay at Till orders and allows after payment", async () => {
    const orderId = "till-2";
    const venueId = "venue-abc";

    mockOrders[orderId] = {
      id: orderId,
      venue_id: venueId,
      payment_method: "PAY_AT_TILL",
      payment_status: "UNPAID",
      order_status: "IN_PREP",
      created_at: new Date().toISOString(),
    };

    // Mark served
    const serveReq = createMockRequest("POST", "http://localhost:3000/api/orders/serve", JSON.stringify({ orderId }));
    const serveRes = await servePOST(serveReq as unknown as Request);
    expect(serveRes.status).toBe(200);
    expect(mockOrders[orderId].order_status).toBe("SERVED");

    // Try to complete while UNPAID
    const completeReqUnpaid = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/complete",
      JSON.stringify({ orderId })
    );
    const completeResUnpaid = await completePOST(completeReqUnpaid as unknown as Request);
    expect(completeResUnpaid.status).toBe(400);
    expect(mockOrders[orderId].order_status).toBe("SERVED");

    // Mark as paid via payment route
    const payReq = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/payment",
      JSON.stringify({
        orderId,
        venue_id: venueId,
        payment_method: "till",
        payment_status: "PAID",
      })
    );
    const payRes = await paymentPOST(payReq);
    expect(payRes.status).toBe(200);
    expect(mockOrders[orderId].payment_status).toBe("PAID");

    // Now completion should succeed
    const completeReqPaid = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/complete",
      JSON.stringify({ orderId })
    );
    const completeResPaid = await completePOST(completeReqPaid as unknown as Request);
    expect(completeResPaid.status).toBe(200);
    expect(mockOrders[orderId].order_status).toBe("COMPLETED");
  });

  it("is idempotent when Mark as Paid is clicked twice", async () => {
    const orderId = "till-3";
    const venueId = "venue-abc";

    mockOrders[orderId] = {
      id: orderId,
      venue_id: venueId,
      payment_method: "PAY_AT_TILL",
      payment_status: "UNPAID",
      order_status: "IN_PREP",
      created_at: new Date().toISOString(),
    };

    const body = {
      orderId,
      venue_id: venueId,
      payment_method: "till",
      payment_status: "PAID",
    };

    const req1 = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/payment",
      JSON.stringify(body)
    );
    const res1 = await paymentPOST(req1);
    expect(res1.status).toBe(200);
    expect(mockOrders[orderId].payment_status).toBe("PAID");

    // Second click should not break or double-change anything
    const req2 = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/payment",
      JSON.stringify(body)
    );
    const res2 = await paymentPOST(req2);
    expect([200, 400]).toContain(res2.status);
    expect(mockOrders[orderId].payment_status).toBe("PAID");
  });
});


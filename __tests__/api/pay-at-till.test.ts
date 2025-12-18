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

// These routes use unified auth. For behavioural tests, bypass auth/venue access and
// provide a consistent context (venueId is derived via the route's extractor when present).
vi.mock("@/lib/auth/unified-auth", () => {
  return {
    withUnifiedAuth:
      (
        handler: (
          req: import("next/server").NextRequest,
          context: {
            venueId: string;
            tier: string;
            role: string;
            user: { id: string };
            venue: {
              venue_id: string;
              owner_user_id: string;
              name: string;
              created_at: string;
              updated_at: string;
            };
          }
        ) => Promise<import("next/server").NextResponse>,
        options?: {
          extractVenueId?: (req: import("next/server").NextRequest) => Promise<string | null>;
        }
      ) =>
      async (req: import("next/server").NextRequest) => {
        const extracted = options?.extractVenueId
          ? await options.extractVenueId(req.clone())
          : null;
        const venueId = extracted || "venue-test";
        return handler(req, {
          venueId,
          tier: "free",
          role: "owner",
          user: { id: "test-user" },
          venue: {
            venue_id: venueId,
            owner_user_id: "test-user",
            name: "Test Venue",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      },
  };
});

// Simple in-memory order store for behavioural tests
const mockOrders: Record<
  string,
  {
    id: string;
    venue_id: string;
    payment_method: string;
    payment_status: string;
    order_status: string;
    kitchen_status?: string;
    service_status?: string;
    completion_status?: string;
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
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
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
    const orderId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const venueId = "venue-abc";

    mockOrders[orderId] = {
      id: orderId,
      venue_id: venueId,
      payment_method: "PAY_AT_TILL",
      payment_status: "UNPAID",
      order_status: "IN_PREP",
      kitchen_status: "BUMPED",
      completion_status: "OPEN",
      service_status: "OPEN",
      created_at: new Date().toISOString(),
    };

    const request = createMockRequest("POST", "http://localhost:3000/api/orders/payment", {
      body: {
        orderId,
        venue_id: venueId,
        payment_method: "till",
        payment_status: "PAID",
      },
    });

    const response = await paymentPOST(request);
    expect(response.status).toBe(200);
    expect(mockOrders[orderId].payment_status).toBe("PAID");
  });

  it("blocks completion for UNPAID Pay at Till orders and allows after payment", async () => {
    const orderId = "0b8887f8-5a7f-4e60-84b6-73c4a67e9f5f";
    const venueId = "venue-abc";

    mockOrders[orderId] = {
      id: orderId,
      venue_id: venueId,
      payment_method: "PAY_AT_TILL",
      payment_status: "UNPAID",
      order_status: "IN_PREP",
      kitchen_status: "BUMPED",
      completion_status: "OPEN",
      service_status: "OPEN",
      created_at: new Date().toISOString(),
    };

    // Mark served
    const serveReq = createMockRequest("POST", "http://localhost:3000/api/orders/serve", {
      body: { orderId },
    });
    const serveRes = await servePOST(serveReq as unknown as Request);
    expect(serveRes.status).toBe(200);
    expect(mockOrders[orderId].order_status).toBe("SERVED");

    // Try to complete while UNPAID
    const completeReqUnpaid = createMockRequest(
      "POST",
      "http://localhost:3000/api/orders/complete",
      {
        body: { orderId },
      }
    );
    const completeResUnpaid = await completePOST(completeReqUnpaid as unknown as Request);
    expect(completeResUnpaid.status).toBe(400);
    expect(mockOrders[orderId].order_status).toBe("SERVED");

    // Mark as paid via payment route
    const payReq = createMockRequest("POST", "http://localhost:3000/api/orders/payment", {
      body: {
        orderId,
        venue_id: venueId,
        payment_method: "till",
        payment_status: "PAID",
      },
    });
    const payRes = await paymentPOST(payReq);
    expect(payRes.status).toBe(200);
    expect(mockOrders[orderId].payment_status).toBe("PAID");

    // Now completion should succeed
    const completeReqPaid = createMockRequest("POST", "http://localhost:3000/api/orders/complete", {
      body: { orderId },
    });
    const completeResPaid = await completePOST(completeReqPaid as unknown as Request);
    expect(completeResPaid.status).toBe(200);
    expect(mockOrders[orderId].order_status).toBe("COMPLETED");
  });

  it("is idempotent when Mark as Paid is clicked twice", async () => {
    const orderId = "5d0f4c4a-f2e1-4baf-a8d1-7d2e7b6f9a1e";
    const venueId = "venue-abc";

    mockOrders[orderId] = {
      id: orderId,
      venue_id: venueId,
      payment_method: "PAY_AT_TILL",
      payment_status: "UNPAID",
      order_status: "IN_PREP",
      kitchen_status: "BUMPED",
      completion_status: "OPEN",
      service_status: "OPEN",
      created_at: new Date().toISOString(),
    };

    const body = {
      orderId,
      venue_id: venueId,
      payment_method: "till",
      payment_status: "PAID",
    };

    const req1 = createMockRequest("POST", "http://localhost:3000/api/orders/payment", { body });
    const res1 = await paymentPOST(req1);
    expect(res1.status).toBe(200);
    expect(mockOrders[orderId].payment_status).toBe("PAID");

    // Second click should not break or double-change anything
    const req2 = createMockRequest("POST", "http://localhost:3000/api/orders/payment", { body });
    const res2 = await paymentPOST(req2);
    expect([200, 400]).toContain(res2.status);
    expect(mockOrders[orderId].payment_status).toBe("PAID");
  });
});

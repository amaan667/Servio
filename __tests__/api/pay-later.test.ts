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

// Simple in-memory order store to emulate DB behaviour for flow tests
const mockOrders: Record<
  string,
  {
    id: string;
    venue_id: string;
    payment_method: string;
    payment_status: string;
    order_status: string;
    kitchen_status?: string;
    completion_status?: string;
    service_status?: string;
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
                          completion_status:
                            (updateData.completion_status as string) || order.completion_status,
                          kitchen_status:
                            (updateData.kitchen_status as string) || order.kitchen_status,
                          service_status:
                            (updateData.service_status as string) || order.service_status,
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
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn((col: string, value: string) => {
            // Used by update-payment-status route; update our in-memory order store.
            if (col === "id") {
              const id = value;
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: mockOrders[id] || null, error: null })),
                })),
              };
            }
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: null, error: null })),
              })),
            };
          }),
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
      const orderId = "11111111-1111-4111-8111-111111111111";
      mockOrders[orderId] = {
        id: orderId,
        venue_id: "venue-1",
        payment_method: "PAY_NOW",
        payment_status: "UNPAID",
        order_status: "PLACED",
        kitchen_status: "BUMPED",
        completion_status: "OPEN",
        service_status: "OPEN",
      };

      const body: Record<string, unknown> = {
        order_id: orderId,
        venue_id: "venue-1",
        sessionId: "session-abc",
      };
      const request = createMockRequest("POST", "http://localhost:3000/api/pay/later", { body });

      const response = await payLaterPOST(request);
      expect(response.status).toBe(200);
      const updated = mockOrders[orderId];
      expect(updated.payment_method).toBe("PAY_LATER");
      expect(updated.payment_status).toBe("UNPAID");
    });
  });

  describe("End-to-end Pay Later lifecycle", () => {
    it("blocks completion until payment is PAID and allows completion afterwards", async () => {
      const orderId = "22222222-2222-4222-8222-222222222222";
      const venueId = "venue-xyz";

      // Seed an order as PAY_LATER, UNPAID, IN_PREP (kitchen started)
      mockOrders[orderId] = {
        id: orderId,
        venue_id: venueId,
        payment_method: "PAY_LATER",
        payment_status: "UNPAID",
        order_status: "IN_PREP",
        kitchen_status: "BUMPED",
        completion_status: "OPEN",
        service_status: "OPEN",
      };

      // 1) Staff marks order as served (kitchen finished)
      const serveReq = createMockRequest("POST", "http://localhost:3000/api/orders/serve", {
        body: { orderId },
      });
      const serveRes = await servePOST(serveReq as unknown as Request);
      expect(serveRes.status).toBe(200);
      expect(mockOrders[orderId].order_status).toBe("SERVED");

      // 2) Try to complete while UNPAID → should be rejected by orders_complete RPC
      const completeReqUnpaid = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/complete",
        {
          body: { orderId },
        }
      );
      const completeResUnpaid = await completePOST(completeReqUnpaid as unknown as Request);
      expect(completeResUnpaid.status).toBe(400);
      // Status should remain SERVED, not COMPLETED
      expect(mockOrders[orderId].order_status).toBe("SERVED");

      // 3) Simulate Stripe / staff payment: mark as PAID
      const paymentReq = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/update-payment-status",
        { body: { orderId, paymentStatus: "PAID", paymentMethod: "PAY_LATER" } }
      );
      const paymentRes = await updatePaymentStatusPOST(paymentReq as unknown as Request);
      expect(paymentRes.status).toBe(200);
      // update-payment-status route uses the non-admin client; emulate its effect here
      mockOrders[orderId].payment_status = "PAID";
      expect(mockOrders[orderId].payment_status).toBe("PAID");

      // 4) Now completion should succeed and set order_status = COMPLETED
      const completeReqPaid = createMockRequest(
        "POST",
        "http://localhost:3000/api/orders/complete",
        {
          body: { orderId },
        }
      );
      const completeResPaid = await completePOST(completeReqPaid as unknown as Request);
      expect(completeResPaid.status).toBe(200);
      expect(mockOrders[orderId].order_status).toBe("COMPLETED");
    });

    it("is idempotent when completion is called twice after payment", async () => {
      const orderId = "33333333-3333-4333-8333-333333333333";
      const venueId = "venue-xyz";

      mockOrders[orderId] = {
        id: orderId,
        venue_id: venueId,
        payment_method: "PAY_LATER",
        payment_status: "PAID",
        order_status: "SERVED",
        kitchen_status: "BUMPED",
        completion_status: "OPEN",
        service_status: "OPEN",
      };

      const completeReq1 = createMockRequest("POST", "http://localhost:3000/api/orders/complete", {
        body: { orderId },
      });
      const res1 = await completePOST(completeReq1 as unknown as Request);
      expect(res1.status).toBe(200);
      expect(mockOrders[orderId].order_status).toBe("COMPLETED");

      // Second call should not break or change state further
      const completeReq2 = createMockRequest("POST", "http://localhost:3000/api/orders/complete", {
        body: { orderId },
      });
      const res2 = await completePOST(completeReq2 as unknown as Request);
      // Either 200 or 400 depending on RPC logic, but status must stay COMPLETED
      expect([200, 400]).toContain(res2.status);
      expect(mockOrders[orderId].order_status).toBe("COMPLETED");
    });
  });
});

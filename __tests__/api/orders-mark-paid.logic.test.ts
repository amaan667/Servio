import { describe, it, expect, vi } from "vitest";
import { createMockRequest, parseJsonResponse } from "../helpers/api-test-helpers";
import { POST as markPaid } from "@/app/api/orders/mark-paid/route";

vi.mock("@/lib/auth/unified-auth", () => ({
  withUnifiedAuth:
    (handler: unknown) =>
    async (req: Request) =>
      (handler as (req: Request, ctx: { venueId: string; user: { id: string }; role: string }) => Promise<Response>)(
        req,
        {
          venueId: "venue-123",
          user: { id: "user-123" },
          role: "manager",
        }
      ),
}));

const createAdminClientMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

describe("POST /api/orders/mark-paid logic", () => {
  it("returns success when order already paid", async () => {
    const orderSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "order-1",
        venue_id: "venue-123",
        payment_status: "PAID",
        payment_method: "PAY_AT_TILL",
      },
      error: null,
    });

    const chain = {
      select: () => chain,
      eq: () => chain,
      single: orderSingle,
      maybeSingle: vi.fn(),
      update: () => chain,
    };

    createAdminClientMock.mockReturnValue({
      from: () => chain,
    });

    const request = createMockRequest("POST", "http://localhost:3000/api/orders/mark-paid", {
      body: { orderId: "order-1" },
    });

    const response = await markPaid(request);
    expect(response.status).toBe(200);
    const payload = await parseJsonResponse<{ success: boolean }>(response);
    expect(payload.success).toBe(true);
  });

  it("rejects confirmation for PAY_NOW orders", async () => {
    const orderSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "order-2",
        venue_id: "venue-123",
        payment_status: "UNPAID",
        payment_method: "PAY_NOW",
      },
      error: null,
    });
    const venueMaybeSingle = vi.fn().mockResolvedValue({
      data: { allow_pay_at_till_for_table_collection: true },
      error: null,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: orderSingle,
      maybeSingle: venueMaybeSingle,
      update: () => chain,
    };

    createAdminClientMock.mockReturnValue({
      from: () => chain,
    });

    const request = createMockRequest("POST", "http://localhost:3000/api/orders/mark-paid", {
      body: { orderId: "order-2" },
    });

    const response = await markPaid(request);
    expect(response.status).toBe(400);
  });
});

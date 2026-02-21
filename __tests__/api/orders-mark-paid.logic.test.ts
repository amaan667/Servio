import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthenticatedRequest, createMockRequest, parseJsonResponse } from "../helpers/api-test-helpers";
import { POST as markPaid } from "@/app/api/orders/mark-paid/route";
import { getAuthUserFromRequest, verifyVenueAccess } from "@/lib/auth/unified-auth";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, reset: Date.now() + 10000 }),
  RATE_LIMITS: { GENERAL: {} },
  getClientIdentifier: () => "test-client",
}));

// Idempotency uses createAdminClient; ensure mock has .rpc() so tryClaimIdempotencyKey returns { claimed: true }

vi.mock("@/lib/auth/unified-auth", () => ({
  getAuthUserFromRequest: vi.fn(),
  verifyVenueAccess: vi.fn(),
  hasRole: (context: { role?: string }, allowedRoles: string[]) =>
    !!context.role && allowedRoles.includes(context.role),
  isOwner: (context: { role?: string }) => context.role === "owner",
}));

const createAdminClientMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

describe("POST /api/orders/mark-paid logic", () => {
  beforeEach(() => {
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({ user: { id: "user-123" }, error: null });
    vi.mocked(verifyVenueAccess).mockResolvedValue({
      venueId: "venue-123",
      venue: { venue_id: "venue-123", owner_user_id: "user-123" },
      user: { id: "user-123" },
      role: "manager",
      tier: "starter",
    });
  });

  it.skip("returns success when order already paid", async () => {
    const fullOrder = {
      id: "order-1",
      venue_id: "venue-123",
      payment_status: "PAID",
      payment_method: "PAY_AT_TILL",
    };
    const orderSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { venue_id: "venue-123" }, error: null })
      .mockResolvedValueOnce({ data: fullOrder, error: null })
      .mockResolvedValueOnce({ data: fullOrder, error: null });

    const chain = {
      select: () => chain,
      eq: () => chain,
      single: orderSingle,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: () => chain,
    };

    createAdminClientMock.mockReturnValue({
      from: () => chain,
    });

    const request = createMockRequest("POST", "http://localhost:3000/api/orders/mark-paid", {
      body: { orderId: "order-1" },
      headers: { "x-idempotency-key": "test-key-1" },
    });

    const response = await markPaid(request);
    expect(response.status).toBe(200);
    const payload = await parseJsonResponse<{ success: boolean }>(response);
    expect(payload.success).toBe(true);
  });

  it("rejects confirmation for PAY_NOW orders", async () => {
    const unpaidOrder = {
      id: "order-2",
      venue_id: "venue-123",
      payment_status: "UNPAID",
      payment_method: "PAY_NOW",
    };
    const orderSingle = vi.fn().mockResolvedValue({ data: unpaidOrder, error: null });
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
      rpc: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    });

    const request = createAuthenticatedRequest(
      "POST",
      "http://localhost:3000/api/orders/mark-paid",
      "user-123",
      {
        body: { orderId: "order-2", venue_id: "venue-123" },
        additionalHeaders: { "x-idempotency-key": "test-key-2" },
      }
    );

    const response = await markPaid(request);
    expect(response.status).toBe(400);
  });
});

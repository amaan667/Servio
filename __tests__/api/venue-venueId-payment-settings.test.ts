/**
 * Regression: payment-settings requires auth and venue access.
 * Fails closed without auth; denies when user has no venue access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createAuthenticatedRequest } from "../helpers/api-test-helpers";
import { GET as paymentSettingsGET } from "@/app/api/venue/[venueId]/payment-settings/route";

const VENUE_ID = "venue-1e02af4d";
const USER_NO_ACCESS = "faba05c6-ae99-48ed-ac4a-e5fdc31db371";

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: { allow_pay_at_till_for_table_collection: true },
              error: null,
            })
          ),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/auth/unified-auth", () => ({
  getAuthUserFromRequest: vi.fn(),
  verifyVenueAccess: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => Promise.resolve({ success: true, remaining: 10, reset: Date.now() + 60000, limit: 100 })),
  RATE_LIMITS: { GENERAL: { limit: 100, window: 60 } },
}));

describe("venue/[venueId]/payment-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when unauthenticated (401 or 500)", async () => {
    const { getAuthUserFromRequest } = await import("@/lib/auth/unified-auth");
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({ user: null, error: "Not authenticated" });

    const req = createMockRequest("GET", `http://localhost:3000/api/venue/${VENUE_ID}/payment-settings`);
    const res = await paymentSettingsGET(req, {
      params: Promise.resolve({ venueId: VENUE_ID }),
    });

    // Must not return 200; fail closed
    expect(res.status).not.toBe(200);
    expect([401, 403, 500]).toContain(res.status);
    if (res.status === 401) {
      const data = await res.json();
      expect(data.error?.message ?? data.message).toMatch(/auth|unauthorized|required/i);
    }
  });

  it("returns 403 when authenticated but no venue access", async () => {
    const { getAuthUserFromRequest, verifyVenueAccess } = await import("@/lib/auth/unified-auth");
    vi.mocked(getAuthUserFromRequest).mockResolvedValue({
      user: { id: USER_NO_ACCESS, email: "other@example.com" } as { id: string; email?: string },
      error: null,
    });
    vi.mocked(verifyVenueAccess).mockResolvedValue(null);

    const req = createAuthenticatedRequest(
      "GET",
      `http://localhost:3000/api/venue/${VENUE_ID}/payment-settings`,
      USER_NO_ACCESS
    );
    const res = await paymentSettingsGET(req, {
      params: Promise.resolve({ venueId: VENUE_ID }),
    });

    expect(res.status).toBe(403);
  });
});

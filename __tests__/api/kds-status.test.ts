import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createAuthenticatedRequest,
  parseJsonResponse,
} from "../helpers/api-test-helpers";
import { GET as getGET } from "@/app/api/kds/status/route";

// =====================================================================================
// Mocks
// =====================================================================================

// Mock Supabase admin client: chain must support .from().select().in().eq() and await
const kdsChain = {
  then(onFulfilled: (v: { data: unknown; error: null; count?: number }) => unknown) {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled);
  },
  select: () => kdsChain,
  eq: () => kdsChain,
  in: () => kdsChain,
  order: () => kdsChain,
  limit: () => kdsChain,
  gte: () => kdsChain,
  single: () => Promise.resolve({ data: null, error: null }),
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
};
vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({
    from: () => kdsChain,
  }),
}));

// Unified auth: we only need to ensure that when headers contain x-user-id,
// authentication + venue access succeed. For missing headers we simulate
// the real behaviour (no auth).
const getAuthUserFromRequestMock = vi.fn();
const verifyVenueAccessMock = vi.fn();

vi.mock("@/lib/auth/unified-auth", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => getAuthUserFromRequestMock(...args),
  verifyVenueAccess: (...args: unknown[]) => verifyVenueAccessMock(...args),
  // The handler also imports helpers, provide simple defaults
  enforceFeatureAccess: vi.fn(async () => ({ allowed: true })),
  hasRole: vi.fn(() => true),
  isOwner: vi.fn(() => true),
}));

// Rate limiting: by default allow, but tests can override behaviour
import type { NextRequest } from "next/server";
import type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit";

const rateLimitMock = vi.fn<
  [_req: NextRequest, _options: RateLimitConfig],
  Promise<RateLimitResult>
>();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    GENERAL: { limit: 100, window: 60 },
    KDS: { limit: 500, window: 60 },
    MENU_PUBLIC: { limit: 60, window: 60 },
    STRICT: { limit: 5, window: 60 },
    ORDER_CREATE: { limit: 30, window: 60 },
  },
  rateLimit: (...args: unknown[]) => rateLimitMock(...(args as [NextRequest, RateLimitConfig])),
  getClientIdentifier: (req: NextRequest) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown",
}));

beforeEach(() => {
  // Default: allow rate limit
  rateLimitMock.mockResolvedValue({
    success: true,
    remaining: 100,
    reset: Date.now() + 60_000,
  });

  // Default unified-auth behaviour: use x-user-id header; fail otherwise
  getAuthUserFromRequestMock.mockImplementation(async (req: NextRequest) => {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return { user: null, error: "No authentication found" };
    }
    return {
      user: {
        id: userId,
        email: req.headers.get("x-user-email") ?? undefined,
      },
      error: null,
    };
  });

  verifyVenueAccessMock.mockResolvedValue({
    venue: { venue_id: "venue-123", owner_user_id: "user-123" },
    user: { id: "user-123", email: "test@example.com" },
    role: "owner",
  });
});

// =====================================================================================
// Tests
// =====================================================================================

describe("Kds Status API", () => {
  describe("GET /api/kds/status", () => {
    it("handles a basic request (legacy smoke test)", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/kds/status?venueId=venue-123"
      );

      const response = await getGET(request);
      expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
    });

    it("returns 401 when auth headers are missing", async () => {
      const request = createMockRequest(
        "GET",
        "http://localhost:3000/api/kds/status?venueId=venue-123"
      );

      const response = await getGET(request);
      expect(response.status).toBe(401);

      const body = await parseJsonResponse<{ success: boolean; error?: { code: string } }>(
        response
      );
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("UNAUTHORIZED");
    });

    it("succeeds when middleware has set x-user-id headers (no auth missing)", async () => {
      const request = createAuthenticatedRequest(
        "GET",
        "http://localhost:3000/api/kds/status?venueId=venue-123",
        "user-123"
      );

      const response = await getGET(request);
      // With valid auth + venue, this should not be an auth error.
      expect(response.status).toBe(200);

      const body = await parseJsonResponse<{
        success: boolean;
        data?: { status: { venue_id: string } };
      }>(response);
      expect(body.success).toBe(true);
      expect(body.data?.status.venue_id).toBe("venue-123");
    });

    it("returns a clear RATE_LIMIT_EXCEEDED error when KDS rate limit is hit", async () => {
      rateLimitMock.mockResolvedValueOnce({
        success: false,
        remaining: 0,
        reset: Date.now() + 5_000,
      });

      const request = createAuthenticatedRequest(
        "GET",
        "http://localhost:3000/api/kds/status?venueId=venue-123",
        "user-123"
      );

      const response = await getGET(request);
      expect(response.status).toBe(429);

      const body = await parseJsonResponse<{
        success: boolean;
        error?: { code: string; message: string; details?: { retryAfter?: number } };
      }>(response);

      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(body.error?.message).toMatch(/Rate limit exceeded/i);
      // retryAfter is optional but should be present when we pass reset
      if (body.error?.details && "retryAfter" in body.error.details) {
        expect(typeof (body.error.details as { retryAfter: number }).retryAfter).toBe("number");
      }
    });
  });
});

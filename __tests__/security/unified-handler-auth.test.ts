import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthUserFromRequestMock = vi.fn();
const verifyVenueAccessMock = vi.fn();
const getAccessContextWithRequestMock = vi.fn();
const rateLimitMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { GENERAL: { limit: 100, windowMs: 60_000 } },
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  getClientIdentifier: () => "test-client",
}));

vi.mock("@/lib/auth/unified-auth", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => getAuthUserFromRequestMock(...args),
  verifyVenueAccess: (...args: unknown[]) => verifyVenueAccessMock(...args),
  hasRole: () => true,
  isOwner: () => true,
}));

vi.mock("@/lib/access/getAccessContext", () => ({
  getAccessContextWithRequest: (...args: unknown[]) => getAccessContextWithRequestMock(...args),
}));

vi.mock("@/lib/db/idempotency", () => ({
  claimIdempotencyKey: vi.fn(async () => ({ status: "acquired" as const })),
  storeIdempotency: vi.fn(async () => undefined),
}));

vi.mock("@/lib/monitoring/performance-tracker", () => ({
  performanceTracker: {
    start: vi.fn(() => ({ end: vi.fn() })),
  },
}));

vi.mock("@/lib/monitoring/structured-logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    logResponse: vi.fn(),
  },
}));

vi.mock("@/lib/monitoring/apm", () => ({
  startTransaction: vi.fn(() => ({
    setTag: vi.fn(),
    finish: vi.fn(),
    addError: vi.fn(),
  })),
}));

vi.mock("@/lib/env", () => ({
  isDevelopment: vi.fn(() => false),
}));

import { createUnifiedHandler } from "@/lib/api/unified-handler";

describe("createUnifiedHandler auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    rateLimitMock.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });

    getAuthUserFromRequestMock.mockResolvedValue({
      user: { id: "user-1", email: "user-1@example.com" },
      error: null,
    });

    verifyVenueAccessMock.mockResolvedValue({
      venue: {
        venue_id: "venue-a",
        owner_user_id: "owner-1",
        venue_name: "Venue A",
        name: "Venue A",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      user: { id: "user-1", email: "user-1@example.com" },
      role: "owner",
      tier: "starter",
      venue_ids: ["venue-a"],
    });

    getAccessContextWithRequestMock.mockResolvedValue({
      user_id: "user-1",
      venue_id: "venue-a",
      role: "owner",
      tier: "starter",
    });
  });

  it("returns 401 when auth is missing", async () => {
    getAuthUserFromRequestMock.mockResolvedValueOnce({
      user: null,
      error: "Not authenticated",
    });

    const handler = createUnifiedHandler(async () => ({ ok: true }));
    const req = new NextRequest("http://localhost/api/protected");
    const res = await handler(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 for cross-tenant venue access denial", async () => {
    verifyVenueAccessMock.mockResolvedValueOnce(null);

    const handler = createUnifiedHandler(
      async () => ({ ok: true }),
      {
        requireVenueAccess: true,
        venueIdSource: "query",
      }
    );

    const req = new NextRequest("http://localhost/api/orders/search?venueId=venue-a", {
      headers: {
        "x-user-tier": "starter",
        "x-user-role": "owner",
        "x-venue-id": "venue-a",
      },
    });

    const res = await handler(req);
    expect(res.status).toBe(403);
  });
});


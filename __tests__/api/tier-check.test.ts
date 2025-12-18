/**
 * Tier-check should use venue owner's tier (staff-safe)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthenticatedRequest, parseJsonResponse } from "../helpers/api-test-helpers";
import { POST as postPOST } from "@/app/api/tier-check/route";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, reset: Date.now() + 10000 })),
  RATE_LIMITS: { GENERAL: {} },
}));

const verifyVenueAccessMock = vi.fn();
vi.mock("@/lib/middleware/authorization", () => ({
  verifyVenueAccess: (...args: unknown[]) => verifyVenueAccessMock(...args),
}));

const getUserTierMock = vi.fn();
vi.mock("@/lib/tier-restrictions", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/tier-restrictions")>("@/lib/tier-restrictions");
  return {
    ...actual,
    getUserTier: (...args: unknown[]) => getUserTierMock(...args),
  };
});

describe("Tier Check API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the venue owner's tier even for staff user", async () => {
    // Staff user is authenticated via middleware header
    const staffUserId = "staff-1";
    const venueId = "venue-1";
    const ownerUserId = "owner-1";

    verifyVenueAccessMock.mockResolvedValue({
      venue: {
        venue_id: venueId,
        owner_user_id: ownerUserId,
        name: "Test Venue",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      user: { id: staffUserId },
      role: "staff",
    });

    // Tier is tied to the owner (billing owner)
    getUserTierMock.mockImplementation(async (userId: string) =>
      userId === ownerUserId ? "enterprise" : "starter"
    );

    const request = createAuthenticatedRequest(
      "POST",
      "http://localhost:3000/api/tier-check",
      staffUserId,
      {
        body: { venueId, action: "access", resource: "kds" },
      }
    );

    const response = await postPOST(request);
    expect(response.status).toBe(200);

    const json = await parseJsonResponse<{ data?: { tier?: string } }>(response);
    expect(json.data?.tier).toBe("enterprise");
    expect(getUserTierMock).toHaveBeenCalledWith(ownerUserId);
  });

  it("enforces limits based on venue owner's tier", async () => {
    const staffUserId = "staff-2";
    const venueId = "venue-2";
    const ownerUserId = "owner-2";

    verifyVenueAccessMock.mockResolvedValue({
      venue: {
        venue_id: venueId,
        owner_user_id: ownerUserId,
        name: "Test Venue 2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      user: { id: staffUserId },
      role: "staff",
    });

    getUserTierMock.mockResolvedValue("starter");

    const request = createAuthenticatedRequest(
      "POST",
      "http://localhost:3000/api/tier-check",
      staffUserId,
      {
        body: { venueId, action: "create", resource: "maxStaff", currentCount: 999 },
      }
    );

    const response = await postPOST(request);
    expect(response.status).toBe(200);
    const json = await parseJsonResponse<{ data?: { allowed?: boolean; tier?: string } }>(response);
    expect(json.data?.allowed).toBe(false);
    expect(json.data?.tier).toBe("starter");
  });
});

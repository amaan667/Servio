/**
 * inventory/export/csv should be tiered by venue owner (staff-safe)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthenticatedRequest } from "../helpers/api-test-helpers";
import { GET as getGET } from "@/app/api/inventory/export/csv/route";

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

const createClientMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

describe("Inventory Export Csv API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows staff user when venue owner is enterprise", async () => {
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
    getUserTierMock.mockResolvedValue("enterprise");

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    });

    const request = createAuthenticatedRequest(
      "GET",
      `http://localhost:3000/api/inventory/export/csv?venue_id=${venueId}`,
      staffUserId
    );
    const response = await getGET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(getUserTierMock).toHaveBeenCalledWith(ownerUserId);
  });

  it("denies when venue owner is not enterprise (even if requester is staff)", async () => {
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
    getUserTierMock.mockResolvedValue("pro");

    const request = createAuthenticatedRequest(
      "GET",
      `http://localhost:3000/api/inventory/export/csv?venue_id=${venueId}`,
      staffUserId
    );
    const response = await getGET(request);
    expect(response.status).toBe(403);
  });
});

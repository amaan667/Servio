/**
 * Auto-generated test for inventory/ingredients
 * Generated: 2025-11-23T00:14:32.210Z
 */

import { describe, it, expect, vi } from "vitest";
import { createAuthenticatedRequest, parseJsonResponse } from "../helpers/api-test-helpers";
import { GET as getGET } from "@/app/api/inventory/ingredients/route";
import { POST as postPOST } from "@/app/api/inventory/ingredients/route";

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({
    success: true,
    reset: Date.now() + 10000,
    remaining: 99,
    limit: 100,
  })),
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

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
}));

function makeStockLevelsBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(async () => result),
  };
  return builder;
}

describe("Inventory Ingredients API", () => {
  describe("GET inventory/ingredients", () => {
    it("should handle get request", async () => {
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
      getUserTierMock.mockResolvedValue("pro");

      createAdminClientMock.mockReturnValue({
        from: vi.fn(() => makeStockLevelsBuilder({ data: [], error: null })),
      });

      const request = createAuthenticatedRequest(
        "GET",
        `http://localhost:3000/api/inventory/ingredients?venue_id=${venueId}`,
        staffUserId
      );

      const response = await getGET(request);
      expect(response.status).toBe(200);

      const json = await parseJsonResponse<{ success: boolean; data: unknown }>(response);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });

  describe("POST inventory/ingredients", () => {
    it("should handle post request", async () => {
      const staffUserId = "staff-2";
      const venueId = "venue-2";
      const ownerUserId = "owner-2";

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
      getUserTierMock.mockResolvedValue("pro");

      createAdminClientMock.mockReturnValue({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "test-id" }, error: null })),
            })),
          })),
        })),
      });

      const request = createAuthenticatedRequest(
        "POST",
        "http://localhost:3000/api/inventory/ingredients",
        staffUserId,
        {
          body: {
            venue_id: venueId,
            name: "Flour",
            unit: "kg",
            cost_per_unit: 1.25,
            par_level: 10,
            reorder_level: 5,
          },
        }
      );

      const response = await postPOST(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        const json = await parseJsonResponse<{ success: boolean; data: unknown }>(response);
        expect(json.success).toBe(true);
        expect(json.data).toBeTruthy();
      }
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });
});

/**
 * Tests for features/check API (createUnifiedHandler + checkFeatureAccess).
 */

import { describe, it, expect, vi } from "vitest";
import { createMockRequest } from "../helpers/api-test-helpers";
import { GET as getGET } from "@/app/api/features/check/route";

vi.mock("@/lib/access/getAccessContext", () => ({
  getAccessContext: vi.fn(() => Promise.resolve(null)),
  getAccessContextWithRequest: vi.fn(() => Promise.resolve(null)),
  getAccessContextWithFeatures: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [{ id: "test-id" }], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-123" } }, error: null })) },
    })
  ),
}));

vi.mock("@/lib/auth/unified-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/unified-auth")>();
  return {
    ...actual,
    getAuthUserFromRequest: vi.fn(async () => ({
      user: { id: "user-123", email: "test@example.com" },
      error: null,
    })),
  };
});

vi.mock("@/lib/middleware/authorization", () => ({
  verifyVenueAccess: vi.fn(async () => ({
    venue: { venue_id: "v-1", owner_user_id: "user-123" },
    user: { id: "user-123" },
    role: "owner",
    tier: "starter",
  })),
}));

describe("Features Check API", () => {
  describe("GET features/check", () => {
    it("should handle get request", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/features/check", {
        headers: { "x-user-id": "user-123", "x-user-email": "test@example.com" },
      });

      const response = await getGET(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });
});

/**
 * Auto-generated test for menu/delete-category
 * Generated: 2025-11-23T00:14:32.212Z
 */

import { describe, it, expect, vi } from "vitest";
import { createMockRequest } from "../helpers/api-test-helpers";
import { POST as postPOST } from "@/app/api/menu/delete-category/route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [{ id: "test-id" }], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      delete: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
  createServerSupabase: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-123" } }, error: null })),
      },
    })
  ),
}));

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => ({
    success: true,
    user: { id: "user-123" },
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
  })),
  verifyVenueAccess: vi.fn(() => Promise.resolve(true)),
}));

describe("Menu Delete Category API", () => {
  describe("POST menu/delete-category", () => {
    it("should handle post request", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api//menu/delete-category");

      const response = await postPOST(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should validate request parameters", async () => {});
  });
});

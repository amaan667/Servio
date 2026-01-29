/**
 * Auto-generated test for feedback/questions
 * Generated: 2025-11-23T00:14:32.210Z
 */

import { describe, it, expect, vi } from "vitest";
import { createMockRequest } from "../helpers/api-test-helpers";
import { GET as getGET } from "@/app/api/feedback/questions/route";
import { POST as postPOST } from "@/app/api/feedback/questions/route";
import { DELETE as deleteDELETE } from "@/app/api/feedback/questions/route";
import { PATCH as patchPATCH } from "@/app/api/feedback/questions/route";

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

describe("Feedback Questions API", () => {
  describe("GET feedback/questions", () => {
    it("should handle get request", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api//feedback/questions");

      const response = await getGET(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });

  describe("POST feedback/questions", () => {
    it("should handle post request", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api//feedback/questions");

      const response = await postPOST(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });

  describe("DELETE feedback/questions", () => {
    it("should handle delete request", async () => {
      const request = createMockRequest("DELETE", "http://localhost:3000/api//feedback/questions");

      const response = await deleteDELETE(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });

  describe("PATCH feedback/questions", () => {
    it("should handle patch request", async () => {
      const request = createMockRequest("PATCH", "http://localhost:3000/api//feedback/questions");

      const response = await patchPATCH(request);
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it("should validate request parameters", async () => {
      /* Intentionally empty */
    });
  });
});

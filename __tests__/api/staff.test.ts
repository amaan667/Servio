 
/**
 * Staff Management API Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMockRequest,
  createAuthenticatedRequest,
  createTestContext,
  cleanupTestContext,
  parseJsonResponse,
} from "../helpers/api-test-helpers";
import { GET as listGet } from "@/app/api/staff/list/route";
import { POST as addPost } from "@/app/api/staff/add/route";
import { DELETE as deleteDelete } from "@/app/api/staff/delete/route";

describe("Staff API Routes", () => {
  let testContext: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    testContext = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  describe("GET /api/staff/list", () => {
    it("should require authentication", async () => {
      const request = createMockRequest(
        "GET",
        `http://localhost:3000/api//staff/list?venueId=${testContext.venueId}`
      );
      const response = await listGet(request);

      expect(response.status).toBe(401);
    });

    it("should return staff list for authenticated user", async () => {
      const request = createAuthenticatedRequest(
        "GET",
        `http://localhost:3000/api//staff/list?venueId=${testContext.venueId}`,
        testContext.userId
      );

      const response = await listGet(request);
      expect(response.status).toBe(200);
      const data = await parseJsonResponse(response);
      expect(data).toHaveProperty("ok");
    });

    it("should require venueId parameter", async () => {
      const request = createAuthenticatedRequest(
        "GET",
        "http://localhost:3000/api//staff/list",
        testContext.userId
      );

      const response = await listGet(request);
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/staff/add", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api//staff/add", {
        body: {
          venueId: testContext.venueId,
          name: "Test Staff",
          role: "server",
        },
      });

      const response = await addPost(request);
      expect(response.status).toBe(401);
    });

    it("should validate required fields", async () => {
      const request = createAuthenticatedRequest(
        "POST",
        "http://localhost:3000/api//staff/add",
        testContext.userId,
        {
          body: {
            venueId: testContext.venueId,
            // Missing name and role
          },
        }
      );

      const response = await addPost(request);
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/staff/delete", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("DELETE", "http://localhost:3000/api//staff/delete", {
        body: {
          venueId: testContext.venueId,
          staffId: "test-id",
        },
      });

      const response = await deleteDelete(request);
      expect(response.status).toBe(401);
    });

    it("should validate required fields", async () => {
      const request = createAuthenticatedRequest(
        "DELETE",
        "http://localhost:3000/api//staff/delete",
        testContext.userId,
        {
          body: {
            venueId: testContext.venueId,
            // Missing staffId
          },
        }
      );

      const response = await deleteDelete(request);
      expect(response.status).toBe(400);
    });
  });
});

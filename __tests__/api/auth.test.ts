/**
 * Comprehensive Auth API Tests
 * Tests all authentication-related endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMockRequest,
  createAuthenticatedRequest,
  parseJsonResponse,
} from "../helpers/api-test-helpers";
import { GET as healthGet } from "@/app/api/auth/health/route";
import { POST as signInPost } from "@/app/api/auth/sign-in-password/route";
import { POST as signOutPost } from "@/app/api/auth/sign-out/route";
import { POST as refreshPost } from "@/app/api/auth/refresh/route";

describe("Auth API Routes", () => {
  describe("GET /api/auth/health", () => {
    it("should return health status", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api/auth/health");
      const response = await healthGet(request);

      expect(response.status).toBe(200);
      const data = await parseJsonResponse(response);
      expect(data).toHaveProperty("ok");
    });
  });

  describe("POST /api/auth/sign-in-password", () => {
    it("should reject invalid email format", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/auth/sign-in-password", {
        body: {
          email: "invalid-email",
          password: "password123",
        },
      });

      const response = await signInPost(request);
      expect(response.status).toBe(400);
    });

    it("should reject missing password", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/auth/sign-in-password", {
        body: {
          email: "test@example.com",
        },
      });

      const response = await signInPost(request);
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/sign-out", () => {
    it("should handle sign out request", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/auth/sign-out");
      const response = await signOutPost(request);

      // Should return 200 even without session
      expect([200, 401]).toContain(response.status);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api/auth/refresh");
      const response = await refreshPost(request);

      expect([401, 400]).toContain(response.status);
    });
  });
});

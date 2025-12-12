/**
 * Test Scaffolding Utilities
 * Common test helpers and patterns for consistent testing
 */

import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Create a mock NextRequest for testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = options;

  const init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init);
}

/**
 * Common test patterns for API routes
 */
export const apiRouteTests = {
  /**
   * Test that route requires authentication
   */
  requiresAuth: async (handler: (req: NextRequest) => Promise<Response>) => {
    it("should return 401 if not authenticated", async () => {
      const req = createMockRequest("http://localhost/api/test");
      const res = await handler(req);
      expect(res.status).toBe(401);
    });
  },

  /**
   * Test that route validates request body
   */
  validatesBody: async (handler: (req: NextRequest) => Promise<Response>) => {
    it("should return 400 for invalid body", async () => {
      const req = createMockRequest("http://localhost/api/test", {
        method: "POST",
        body: { invalid: "data" },
      });
      const res = await handler(req);
      expect(res.status).toBe(400);
    });
  },

  /**
   * Test successful response format
   */
  returnsSuccessFormat: async (handler: (req: NextRequest) => Promise<Response>) => {
    it("should return success format", async () => {
      const req = createMockRequest("http://localhost/api/test");
      const res = await handler(req);
      const data = await res.json();

      expect(data).toHaveProperty("ok");
      if (data.ok) {
        expect(data).toHaveProperty("data");
      } else {
        expect(data).toHaveProperty("error");
      }
    });
  },
};

/**
 * Mock Supabase client for testing
 */
export function createMockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
  };
}

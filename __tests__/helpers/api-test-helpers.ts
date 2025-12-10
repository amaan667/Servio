 
/**
 * API Test Helpers
 * Utilities for testing API routes consistently
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export interface TestContext {
  userId: string;
  venueId: string;
  supabase: ReturnType<typeof createAdminClient>;
}

/**
 * Create a mock NextRequest for API route testing
 */
type MockRequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
};

export function createMockRequest(
  method: string,
  url: string,
  options?: MockRequestOptions
): NextRequest {
  const headers = new Headers(options?.headers || {});
  if (options?.cookies) {
    const cookieString = Object.entries(options.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
    headers.set("cookie", cookieString);
  }

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (options?.body) {
    requestInit.body = JSON.stringify(options.body);
    headers.set("content-type", "application/json");
  }

  return new NextRequest(url, requestInit);
}

/**
 * Create authenticated request with user session
 */
export function createAuthenticatedRequest(
  method: string,
  url: string,
  userId: string,
  options?: {
    body?: unknown;
    additionalHeaders?: Record<string, string>;
  }
): NextRequest {
  return createMockRequest(method, url, {
    ...options,
    headers: {
      "x-user-id": userId,
      "x-user-email": `test-${userId}@example.com`,
      ...options?.additionalHeaders,
    },
  });
}

/**
 * Assert API response structure
 */
export function assertApiResponse(response: Response, expectedStatus: number) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${response.body}`
    );
  }
}

/**
 * Parse JSON response with error handling
 */
export async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${text}. Error: ${error}`);
  }
}

/**
 * Create test venue and user for testing
 */
export async function createTestContext(): Promise<TestContext> {
  const supabase = createAdminClient();

  // Create test user
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: `test-${Date.now()}@example.com`,
    password: "test-password-123",
    email_confirm: true,
  });

  if (userError || !userData.user) {
    throw new Error(`Failed to create test user: ${userError?.message}`);
  }

  const userId = userData.user.id;

  // Create test venue
  const venueId = `test-venue-${Date.now()}`;
  const { error: venueError } = await supabase.from("venues").insert({
    venue_id: venueId,
    venue_name: "Test Venue",
    business_type: "restaurant",
    owner_user_id: userId,
    timezone: "UTC",
    currency: "USD",
    subscription_tier: "free",
    is_active: true,
  });

  if (venueError) {
    throw new Error(`Failed to create test venue: ${venueError.message}`);
  }

  return {
    userId,
    venueId,
    supabase,
  };
}

/**
 * Cleanup test data
 */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  const { supabase, venueId, userId } = context;

  // Delete venue
  await supabase.from("venues").delete().eq("venue_id", venueId);

  // Delete user
  await supabase.auth.admin.deleteUser(userId);
}

/**
 * Wait for async operations (useful for realtime tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

describe("Rate Limiting", () => {
  beforeEach(() => {
    // Clear rate limit store between tests
    // `rateLimit` uses an internal in-memory store when Redis isn't available.
    // In tests we avoid reaching into module internals and instead use unique identifiers per test.
  });

  it("should allow requests within rate limit", async () => {
    const request = new NextRequest("http://localhost:3000/api/test");
    const result = await rateLimit(request, { ...RATE_LIMITS.GENERAL, identifier: "test-allow" });

    expect(result.success).toBe(true);
    expect(result.remaining).toBeLessThan(RATE_LIMITS.GENERAL.limit);
  });

  it("should block requests exceeding rate limit", async () => {
    const request = new NextRequest("http://localhost:3000/api/test");
    const identifier = "test-block";

    // Exhaust rate limit
    for (let i = 0; i < RATE_LIMITS.STRICT.limit; i++) {
      await rateLimit(request, { ...RATE_LIMITS.STRICT, identifier });
    }

    // Next request should be blocked
    const result = await rateLimit(request, { ...RATE_LIMITS.STRICT, identifier });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should have stricter limits for auth endpoints vs general endpoints", () => {
    expect(RATE_LIMITS.AUTH.limit).toBeLessThan(RATE_LIMITS.GENERAL.limit);
  });
});

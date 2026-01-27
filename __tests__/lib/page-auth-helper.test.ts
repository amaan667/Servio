import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Headers as HeadersLike } from "next/dist/server/web/spec-extension/adapters/headers";
import { getAuthFromMiddlewareHeaders, requirePageAuth } from "@/lib/auth/page-auth-helper";

// next/headers is used inside getAuthFromMiddlewareHeaders; we mock it to
// control the header values returned in tests.
const headersMock = vi.fn<[], Promise<HeadersLike>>();

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

function createHeaders(values: Record<string, string | null>): HeadersLike {
  return {
    get(name: string) {
      const key = name.toLowerCase();
      const match = Object.entries(values).find(([k]) => k.toLowerCase() === key);
      return match ? match[1] : null;
    },
  } as unknown as HeadersLike;
}

beforeEach(() => {
  headersMock.mockReset();
});

describe("getAuthFromMiddlewareHeaders", () => {
  it("returns null when x-user-id is missing", async () => {
    headersMock.mockResolvedValue(
      createHeaders({
        "x-user-email": "test@example.com",
        "x-user-tier": "pro",
        "x-user-role": "owner",
        "x-venue-id": "venue-123",
      })
    );

    const result = await getAuthFromMiddlewareHeaders();
    expect(result).toBeNull();
  });

  it("builds a PageAuthContext when middleware headers are present", async () => {
    headersMock.mockResolvedValue(
      createHeaders({
        "x-user-id": "user-123",
        "x-user-email": "test@example.com",
        "x-user-tier": "pro",
        "x-user-role": "owner",
        "x-venue-id": "venue-123",
      })
    );

    const result = await getAuthFromMiddlewareHeaders();
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-123");
    expect(result?.user.email).toBe("test@example.com");
    expect(result?.venueId).toBe("venue-123");
    expect(result?.tier).toBe("pro");
    expect(result?.role).toBe("owner");

    // Sanity-check feature access helper wiring (exact tiers/features tested elsewhere)
    expect(typeof result?.hasFeatureAccess).toBe("function");
  });
});

describe("requirePageAuth", () => {
  it("returns null when auth is missing", async () => {
    headersMock.mockResolvedValue(
      createHeaders({
        // no x-user-id header
        "x-user-tier": "starter",
        "x-user-role": "viewer",
      })
    );

    const result = await requirePageAuth();
    expect(result).toBeNull();
  });

  it("respects requireRole and returns null on role mismatch", async () => {
    headersMock.mockResolvedValue(
      createHeaders({
        "x-user-id": "user-123",
        "x-user-email": "viewer@example.com",
        "x-user-tier": "starter",
        "x-user-role": "viewer",
        "x-venue-id": "venue-123",
      })
    );

    const result = await requirePageAuth(undefined, { requireRole: ["owner", "manager"] });
    expect(result).toBeNull();
  });

  it("returns auth context when role requirement is satisfied", async () => {
    headersMock.mockResolvedValue(
      createHeaders({
        "x-user-id": "user-123",
        "x-user-email": "owner@example.com",
        "x-user-tier": "pro",
        "x-user-role": "owner",
        "x-venue-id": "venue-123",
      })
    );

    const result = await requirePageAuth(undefined, { requireRole: ["owner", "manager"] });
    expect(result).not.toBeNull();
    expect(result?.role).toBe("owner");
  });
});



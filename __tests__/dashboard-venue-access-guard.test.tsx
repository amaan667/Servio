/**
 * Regression: dashboard denies access when authenticated but role is null (no venue access).
 * Prevents cross-tenant data exposure.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import ReactDOMServer from "react-dom/server";

vi.mock("@/lib/auth/get-auth-context", () => ({
  getAuthContext: vi.fn(),
}));

describe("Dashboard venue access guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies access when isAuthenticated is true and role is null", async () => {
    const { getAuthContext } = await import("@/lib/auth/get-auth-context");
    vi.mocked(getAuthContext).mockResolvedValue({
      userId: "user-other",
      email: "other@example.com",
      venueId: "venue-1e02af4d",
      role: null,
      tier: null,
      isAuthenticated: true,
      hasFeatureAccess: () => false,
    });

    const VenuePage = (await import("@/app/dashboard/[venueId]/page")).default;
    const result = await VenuePage({ params: { venueId: "venue-1e02af4d" } });

    // Guard must render "Access denied", not dashboard data
    expect(result).toBeDefined();
    const html = ReactDOMServer.renderToStaticMarkup(result);
    expect(html).toContain("Access denied");
    expect(html).toContain("You do not have access to this venue");
  });
});

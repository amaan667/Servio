/**
 * staff/invitations should enforce tier limits using venue owner's tier (staff-safe)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, parseJsonResponse } from "../helpers/api-test-helpers";
import { POST as postPOST } from "@/app/api/staff/invitations/route";

const getUserSafeMock = vi.fn();
vi.mock("@/utils/getUserSafe", () => ({
  getUserSafe: () => getUserSafeMock(),
}));

const checkLimitMock = vi.fn();
vi.mock("@/lib/tier-restrictions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tier-restrictions")>(
    "@/lib/tier-restrictions"
  );
  return {
    ...actual,
    checkLimit: (...args: unknown[]) => checkLimitMock(...args),
  };
});

const createAdminClientMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

describe("Staff Invitations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks maxStaff limit using venue.owner_user_id (not inviter user id)", async () => {
    const inviterUserId = "manager-1";
    const ownerUserId = "owner-1";
    const venueId = "venue-1";

    getUserSafeMock.mockResolvedValue({ id: inviterUserId });

    // Force early exit at limit check so we don't need to mock invite email + inserts
    checkLimitMock.mockResolvedValue({ allowed: false, limit: 3, currentTier: "starter" });

    // Minimal fluent mock for the few queries used before limit check
    const venuesQuery = {
      select: vi.fn(() => venuesQuery),
      eq: vi.fn(() => venuesQuery),
      single: vi.fn(async () => ({
        data: { owner_user_id: ownerUserId, venue_name: "Test Venue" },
        error: null,
      })),
    };
    const rolesQuery = {
      select: vi.fn(() => rolesQuery),
      eq: vi.fn(() => rolesQuery),
      single: vi.fn(async () => ({ data: { role: "manager" }, error: null })),
    };
    const staffCountQuery = {
      select: vi.fn(() => staffCountQuery),
      eq: vi.fn(async () => ({ count: 3, error: null })),
    };

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "venues") return venuesQuery;
        if (table === "user_venue_roles") {
          // Distinguish the staff count query vs role query by select args
          return {
            select: vi.fn((columns: string, opts?: { count?: string; head?: boolean }) => {
              if (columns === "id" && opts?.count === "exact" && opts?.head === true) {
                return staffCountQuery;
              }
              return rolesQuery;
            }),
            eq: rolesQuery.eq,
            single: rolesQuery.single,
          };
        }
        return { select: vi.fn(() => Promise.resolve({ data: null, error: null })) };
      }),
    });

    const request = createMockRequest("POST", "http://localhost:3000/api/staff/invitations", {
      body: { email: "test@example.com", role: "staff", venue_id: venueId },
    });

    const response = await postPOST(request);
    expect(response.status).toBe(403);

    // Assert limit check uses the venue owner's userId
    expect(checkLimitMock).toHaveBeenCalledWith(ownerUserId, "maxStaff", 3);

    const json = await parseJsonResponse<{ error?: string }>(response);
    expect(json.error).toBeDefined();
  });
});

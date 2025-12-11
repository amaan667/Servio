/**
 * @fileoverview Tests for usePageAuth hook
 * @module __tests__/hooks/usePageAuth
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePageAuth } from "@/app/dashboard/[venueId]/hooks/usePageAuth";
import { supabaseBrowser } from "@/lib/supabase";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  supabaseBrowser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("usePageAuth", () => {
  const mockVenueId = "venue-123";
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
      from: vi.fn(),
    };

    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as never);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: mockVenueId,
        pageName: "Test Page",
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.userRole).toBe(null);
  });

  it("should set auth error when user is not signed in", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
      from: vi.fn(),
    };

    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as never);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: mockVenueId,
        pageName: "Test Page",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should set user and role when authenticated as owner", async () => {
    const mockUser = {
      id: mockUserId,
      email: "test@example.com",
      user_metadata: { full_name: "Test User" },
    };

    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: mockUser } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            venue_id: mockVenueId,
            venue_name: "Test Venue",
            owner_user_id: mockUserId,
          },
          error: null,
        }),
      })),
    };

    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as never);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: mockVenueId,
        pageName: "Test Page",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.userRole).toBe("owner");
    expect(result.current.venueName).toBe("Test Venue");
    expect(result.current.hasAccess).toBe(true);
  });

  it("should check required roles and set hasAccess accordingly", async () => {
    const mockUser = {
      id: mockUserId,
      email: "test@example.com",
    };

    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: mockUser } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((tableName: string) => {
        if (tableName === "venues") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (tableName === "user_venue_roles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: "staff" },
              error: null,
            }),
          };
        }
        return { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
      }),
    };

    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as never);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: mockVenueId,
        pageName: "Test Page",
        requiredRoles: ["owner", "manager"],
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userRole).toBe("staff");
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.authError).toContain("owner, manager");
  });
});

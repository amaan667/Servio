import { renderHook, waitFor } from "@testing-library/react";
import { usePageAuth } from "@/app/dashboard/[venueId]/hooks/usePageAuth";
import { supabaseBrowser } from "@/lib/supabase";

// Mock dependencies
jest.mock("@/lib/supabase");
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe("usePageAuth", () => {
  const mockSession = {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      user_metadata: { full_name: "Test User" },
    },
  };

  const mockVenue = {
    venue_id: "test-venue",
    venue_name: "Test Venue",
    owner_user_id: "test-user-id",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate owner successfully", async () => {
    const mockSupabase = {
      auth: {
        getSession: jest.fn().resolves({ data: { session: mockSession } }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: mockVenue }),
      single: jest.fn(),
    };

    (supabaseBrowser as jest.Mock).mockReturnValue(mockSupabase);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: "test-venue",
        pageName: "Test Feature",
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeTruthy();
    expect(result.current.userRole).toBe("owner");
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.authError).toBeNull();
  });

  it("should handle role restrictions correctly", async () => {
    const mockSupabase = {
      auth: {
        getSession: jest.fn().resolves({ data: { session: mockSession } }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest
        .fn()
        .mockResolvedValueOnce({ data: null }) // Not owner
        .mockResolvedValueOnce({ data: { role: "kitchen_staff" } }), // Kitchen staff role
      single: jest.fn().mockResolvedValue({ data: { venue_name: "Test Venue" } }),
    };

    (supabaseBrowser as jest.Mock).mockReturnValue(mockSupabase);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: "test-venue",
        pageName: "Analytics",
        requiredRoles: ["owner", "manager"],
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.authError).toContain("requires one of these roles");
  });

  it("should allow owner access regardless of role restrictions", async () => {
    const mockSupabase = {
      auth: {
        getSession: jest.fn().resolves({ data: { session: mockSession } }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValueOnce({ data: mockVenue }),
      single: jest.fn(),
    };

    (supabaseBrowser as jest.Mock).mockReturnValue(mockSupabase);

    const { result } = renderHook(() =>
      usePageAuth({
        venueId: "test-venue",
        pageName: "Analytics",
        requiredRoles: ["manager"], // Owner not in required roles
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.userRole).toBe("owner");
    expect(result.current.hasAccess).toBe(true); // Owner has access anyway
  });
});

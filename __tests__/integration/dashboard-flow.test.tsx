 
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import DashboardClient from "@/app/dashboard/[venueId]/page.client";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/app/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseBrowser: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/hooks/usePrefetch", () => ({
  useDashboardPrefetch: vi.fn(),
}));

vi.mock("@/lib/connection-monitor", () => ({
  useConnectionMonitor: vi.fn(() => ({
    isOnline: true,
    isOffline: false,
    isSlowConnection: false,
  })),
}));

describe("Dashboard Flow Integration", () => {
  const mockPush = vi.fn();
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    user_metadata: { full_name: "Test User" },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useRouter as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
    });

    (useAuth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      user: mockUser,
      loading: false,
      signOut: vi.fn(),
    });
  });

  it("should render dashboard with all main sections", async () => {
    render(<DashboardClient venueId="venue-123" />);

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  it("should display loading state initially", () => {
    (useAuth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      user: null,
      loading: true,
    });

    render(<DashboardClient venueId="venue-123" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should redirect to sign-in when user is not authenticated", async () => {
    (useAuth as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      user: null,
      loading: false,
    });

    render(<DashboardClient venueId="venue-123" />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("should handle venue access denied", async () => {
    // Mock venue access denied scenario
    vi.mock("@/lib/supabase", () => ({
      supabaseBrowser: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { message: "Access denied" },
                })
              ),
            })),
          })),
        })),
      })),
    }));

    render(<DashboardClient venueId="venue-123" />);

    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });
});

/**
 * Dashboard Integration Tests
 * Tests the complete dashboard functionality including authentication, data loading, and real-time updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardClient from '@/app/dashboard/[venueId]/page.client';
import { supabaseBrowser } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: vi.fn(() => ({
    auth: {
      getSession: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn()
          })),
          single: vi.fn()
        }))
      }))
    }))
  }))
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  })
}));

// Mock hooks
vi.mock('@/hooks/usePrefetch', () => ({
  useDashboardPrefetch: vi.fn()
}));

vi.mock('@/lib/connection-monitor', () => ({
  useConnectionMonitor: () => ({ isOnline: true, latency: 50 })
}));

describe('Dashboard Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardClient venueId="test-venue" />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('should show sign-in message when user is not authenticated', async () => {
    const mockSupabase = vi.mocked(supabaseBrowser);
    mockSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null
        })
      },
      from: vi.fn()
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardClient venueId="test-venue" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Please sign in to access this venue')).toBeInTheDocument();
    });
  });

  it('should load dashboard when user is authenticated and has access', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    };

    const mockVenue = {
      venue_id: 'test-venue',
      venue_name: 'Test Venue',
      owner_user_id: 'user-123'
    };

    const mockSupabase = vi.mocked(supabaseBrowser);
    mockSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: mockUser } },
          error: null
        })
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockVenue,
                error: null
              })
            }))
          }))
        }))
      }))
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardClient venueId="test-venue" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
    });
  });

  it('should show access denied when user does not have venue access', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    };

    const mockSupabase = vi.mocked(supabaseBrowser);
    mockSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: mockUser } },
          error: null
        })
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          }))
        }))
      }))
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardClient venueId="test-venue" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  it('should handle authentication errors gracefully', async () => {
    const mockSupabase = vi.mocked(supabaseBrowser);
    mockSupabase.mockReturnValue({
      auth: {
        getSession: vi.fn().mockRejectedValue(new Error('Authentication failed'))
      },
      from: vi.fn()
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardClient venueId="test-venue" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });
  });
});

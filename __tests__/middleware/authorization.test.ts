/**
 * Authorization Middleware Tests
 * Tests for authentication and authorization logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  verifyVenueAccess,
  getAuthenticatedUser,
  requireOwner,
  requireStaffOrOwner,
} from '@/lib/middleware/authorization';

// Mock Supabase client
vi.mock('@/lib/supabase/unified-client', () => ({
  createSupabaseClient: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Authorization Middleware', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
        getSession: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };
  });

  describe('verifyVenueAccess', () => {
    it('should grant access to venue owner', async () => {
      const mockVenue = {
        venue_id: 'venue-1',
        owner_id: 'user-1',
        name: 'Test Venue',
      };

      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // user_venue_roles check
        .mockResolvedValueOnce({ data: mockVenue, error: null }); // venues check

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const access = await verifyVenueAccess('venue-1', 'user-1');

      expect(access).toBeTruthy();
      expect(access?.venue).toEqual(mockVenue);
      expect(access?.role).toBe('owner');
    });

    it('should grant access to staff member', async () => {
      const mockRole = { role: 'staff' };
      const mockVenue = {
        venue_id: 'venue-1',
        owner_id: 'user-2',
        name: 'Test Venue',
      };

      // First call: user_venue_roles check
      // Second call: venues check with single()
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: mockRole, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: mockVenue, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const access = await verifyVenueAccess('venue-1', 'user-1');

      expect(access).toBeTruthy();
      expect(access?.venue).toEqual(mockVenue);
      expect(access?.role).toBe('staff');
    });

    it('should deny access to unauthorized user', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const access = await verifyVenueAccess('venue-1', 'user-1');

      expect(access).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: new Error('Database error') });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const access = await verifyVenueAccess('venue-1', 'user-1');

      expect(access).toBeNull();
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return authenticated user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const { user, error } = await getAuthenticatedUser();

      expect(user).toEqual(mockUser);
      expect(error).toBeNull();
    });

    it('should return null for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const { user, error } = await getAuthenticatedUser();

      expect(user).toBeNull();
      expect(error).toBeTruthy();
    });

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const { user, error } = await getAuthenticatedUser();

      expect(user).toBeNull();
      expect(error).toBe('Token expired');
    });
  });

  describe('requireOwner', () => {
    it('should return true for owner', () => {
      const context = {
        venue: { venue_id: 'venue-1' },
        user: { id: 'user-1' },
        role: 'owner',
        venueId: 'venue-1',
      };

      expect(requireOwner(context)).toBe(true);
    });

    it('should return false for non-owner', () => {
      const context = {
        venue: { venue_id: 'venue-1' },
        user: { id: 'user-1' },
        role: 'staff',
        venueId: 'venue-1',
      };

      expect(requireOwner(context)).toBe(false);
    });
  });

  describe('requireStaffOrOwner', () => {
    it('should return true for owner', () => {
      const context = {
        venue: { venue_id: 'venue-1' },
        user: { id: 'user-1' },
        role: 'owner',
        venueId: 'venue-1',
      };

      expect(requireStaffOrOwner(context)).toBe(true);
    });

    it('should return true for staff', () => {
      const context = {
        venue: { venue_id: 'venue-1' },
        user: { id: 'user-1' },
        role: 'staff',
        venueId: 'venue-1',
      };

      expect(requireStaffOrOwner(context)).toBe(true);
    });

    it('should return true for manager', () => {
      const context = {
        venue: { venue_id: 'venue-1' },
        user: { id: 'user-1' },
        role: 'manager',
        venueId: 'venue-1',
      };

      expect(requireStaffOrOwner(context)).toBe(true);
    });

    it('should return false for customer', () => {
      const context = {
        venue: { venue_id: 'venue-1' },
        user: { id: 'user-1' },
        role: 'customer',
        venueId: 'venue-1',
      };

      expect(requireStaffOrOwner(context)).toBe(false);
    });
  });
});

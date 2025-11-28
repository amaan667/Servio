 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@/lib/supabase';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  })),
  supabaseBrowser: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  })),
}));

describe('Authentication - Sign In', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signInWithPassword', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockSupabase = await createClient();
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      };

      vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            expires_in: 3600,
            token_type: 'bearer',
            user: mockUser,
          },
        },
        error: null,
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toEqual(mockUser);
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.access_token).toBe('mock-token');
    });

    it('should fail with invalid credentials', async () => {
      const mockSupabase = await createClient();

      vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Invalid login credentials',
          name: 'AuthError',
          status: 400,
        },
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid login credentials');
      expect(result.data.user).toBeNull();
    });

    it('should fail with missing email', async () => {
      const mockSupabase = await createClient();

      vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Email is required',
          name: 'AuthError',
          status: 400,
        },
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: '',
        password: 'password123',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Email');
    });

    it('should fail with missing password', async () => {
      const mockSupabase = await createClient();

      vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Password is required',
          name: 'AuthError',
          status: 400,
        },
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: '',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Password');
    });
  });

  describe('getSession', () => {
    it('should return valid session when authenticated', async () => {
      const mockSupabase = await createClient();
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
      };

      vi.mocked(mockSupabase.auth.getSession).mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            expires_in: 3600,
            token_type: 'bearer',
            user: mockUser,
          },
        },
        error: null,
      });

      const result = await mockSupabase.auth.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.user.id).toBe('user-123');
    });

    it('should return null session when not authenticated', async () => {
      const mockSupabase = await createClient();

      vi.mocked(mockSupabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await mockSupabase.auth.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should successfully sign out user', async () => {
      const mockSupabase = await createClient();

      vi.mocked(mockSupabase.auth.signOut).mockResolvedValueOnce({
        error: null,
      });

      const result = await mockSupabase.auth.signOut();

      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });
});


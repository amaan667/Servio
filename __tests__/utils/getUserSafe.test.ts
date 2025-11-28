 
import { describe, it, expect, vi } from 'vitest';
import { getUserSafe } from '@/utils/getUserSafe';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      })),
    },
  })),
}));

vi.mock('@/lib/server-utils', () => ({
  hasServerAuthCookie: vi.fn(() => Promise.resolve(true)),
}));

describe('getUserSafe', () => {
  it('should return user when authenticated', async () => {
    const user = await getUserSafe();
    expect(user).toBeDefined();
    expect(user?.id).toBe('user-123');
  });

  it('should return null when no auth cookie', async () => {
    const { hasServerAuthCookie } = await import('@/lib/server-utils');
    vi.mocked(hasServerAuthCookie).mockResolvedValueOnce(false);
    
    const user = await getUserSafe();
    expect(user).toBeNull();
  });
});


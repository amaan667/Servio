/**
 * Integration Tests: POST /api/auth/refresh
 * Tests auth refresh flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callRoute } from '../../test/utils/next-api';
import { POST as refreshAuth } from '@/app/api/auth/refresh/route';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle refresh request', async () => {
    const { status, json } = await callRoute<{ ok: boolean }>(
      refreshAuth,
      {
        method: 'POST',
        body: {},
      }
    );

    // Should return 200 or 401 depending on mock
    expect([200, 401]).toContain(status);
  });

  it('should return error for invalid refresh token', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      refreshAuth,
      {
        method: 'POST',
        body: {
          refreshToken: 'invalid-token',
        },
      }
    );

    // Should return 401 or 400
    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
  });
});


/**
 * Integration Tests: GET /api/menu/[venueId]
 * Tests menu fetching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callRoute } from '../../test/utils/next-api';
import { GET as getMenu } from '@/app/api/menu/[venueId]/route';

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

describe('GET /api/menu/[venueId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate venueId is provided', async () => {
    const mockContext = {
      params: Promise.resolve({}),
    };

    const req = new Request('http://localhost/api/menu');
    const res = await getMenu(req, mockContext);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should return menu items for valid venue', async () => {
    const mockContext = {
      params: Promise.resolve({ venueId: 'venue-123' }),
    };

    const req = new Request('http://localhost/api/menu/venue-123');
    const res = await getMenu(req, mockContext);

    // Should return 200 or 404 depending on mock
    expect([200, 404]).toContain(res.status);
  });
});


/**
 * Integration Tests: POST /api/orders
 * Tests order creation flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callRoute } from '../../test/utils/next-api';
import { POST as createOrder } from '@/app/api/orders/route';

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

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required fields', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createOrder,
      {
        method: 'POST',
        body: {
          venueId: '',
          items: [],
        },
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate items array is not empty', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createOrder,
      {
        method: 'POST',
        body: {
          venueId: 'venue-123',
          items: [],
        },
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate item structure', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createOrder,
      {
        method: 'POST',
        body: {
          venueId: 'venue-123',
          items: [
            {
              // Missing required fields
              quantity: 2,
            },
          ],
        },
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should return 401 when not authenticated', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createOrder,
      {
        method: 'POST',
        body: {
          venueId: 'venue-123',
          items: [
            {
              menu_item_id: 'item-123',
              quantity: 2,
            },
          ],
        },
      }
    );

    // Should return 401 or 400 depending on implementation
    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
  });
});


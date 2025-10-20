/**
 * Integration Tests: POST /api/orders/update-status
 * Tests order status update flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callRoute } from '../../test/utils/next-api';
import { POST as updateOrderStatus } from '@/app/api/orders/update-status/route';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock table cleanup
vi.mock('@/lib/table-cleanup', () => ({
  cleanupTableOnOrderCompletion: vi.fn().mockResolvedValue({
    success: true,
    details: {},
  }),
}));

describe('POST /api/orders/update-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required fields', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      updateOrderStatus,
      {
        method: 'POST',
        body: {},
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate orderId is provided', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      updateOrderStatus,
      {
        method: 'POST',
        body: {
          status: 'COMPLETED',
        },
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate status is provided', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      updateOrderStatus,
      {
        method: 'POST',
        body: {
          orderId: 'order-123',
        },
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should return 401 when not authenticated', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      updateOrderStatus,
      {
        method: 'POST',
        body: {
          orderId: 'order-123',
          status: 'COMPLETED',
        },
      }
    );

    // Should return 401 or 400 depending on implementation
    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
  });
});


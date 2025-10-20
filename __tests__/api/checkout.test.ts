/**
 * Integration Tests: POST /api/checkout
 * Tests checkout flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callRoute } from '../../test/utils/next-api';
import { POST as createCheckout } from '@/app/api/checkout/route';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required fields', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createCheckout,
      {
        method: 'POST',
        body: {},
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate venueId is provided', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createCheckout,
      {
        method: 'POST',
        body: {
          items: [],
        },
      }
    );

    expect(status).toBeGreaterThanOrEqual(400);
    expect(json.ok).toBe(false);
    expect(json.error).toBeDefined();
  });

  it('should validate items array', async () => {
    const { status, json } = await callRoute<{ ok: boolean; error?: string }>(
      createCheckout,
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
});


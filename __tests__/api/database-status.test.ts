/**
 * Database Status API Test
 * Tests for the standardized API response shape
 */

import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/debug/database-status/route';
import { call } from './_helpers';

describe('Database Status API', () => {
  it('returns standard shape { ok, data }', async () => {
    const { status, json } = await call(GET);
    expect(status).toBe(200);
    expect(json).toHaveProperty('ok', true);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('tables');
    expect(json.data).toHaveProperty('message');
  });
});


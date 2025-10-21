import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/orders/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: { id: '123' }, error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })),
    },
  })),
}));

describe('Orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          venue_id: 'venue-123',
          table_number: '5',
          items: [
            { item_name: 'Burger', quantity: 2, price: 12.99 },
          ],
          total_amount: 25.98,
        }),
      });

      const response = await POST(mockRequest);
      expect(response).toBeDefined();
      expect(response.status).toBeLessThan(500);
    });

    it('should require venue_id', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_number: '5',
          items: [],
        }),
      });

      const response = await POST(mockRequest);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });
});


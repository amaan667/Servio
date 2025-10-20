/**
 * Orders API Integration Tests
 * Tests for order API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/orders/route';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabaseServer: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/middleware/authorization', () => ({
  withAuthorization: (handler: any) => handler,
}));

describe('Orders API', () => {
  let mockSupabase: any;
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      url: 'http://localhost:3000/api/orders?venueId=venue-1',
      method: 'GET',
    };
  });

  describe('GET /api/orders', () => {
    it('should return orders for a venue', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          venue_id: 'venue-1',
          order_status: 'PLACED',
          total_amount: 25.99,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockSupabase.maybeSingle.mockResolvedValue({ data: mockOrders, error: null });

      const { supabaseServer } = await import('@/lib/supabase');
      vi.mocked(supabaseServer).mockResolvedValue(mockSupabase);

      const response = await GET(mockRequest as NextRequest, {
        params: { venueId: 'venue-1' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.orders).toEqual(mockOrders);
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      const { supabaseServer } = await import('@/lib/supabase');
      vi.mocked(supabaseServer).mockResolvedValue(mockSupabase);

      const response = await GET(mockRequest as NextRequest, {
        params: { venueId: 'venue-1' },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('should filter orders by status', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: [], error: null });

      const { supabaseServer } = await import('@/lib/supabase');
      vi.mocked(supabaseServer).mockResolvedValue(mockSupabase);

      Object.defineProperty(mockRequest, 'url', { value: 'http://localhost:3000/api/orders?venueId=venue-1&status=COMPLETED', writable: true });

      await GET(mockRequest as NextRequest, {
        params: { venueId: 'venue-1' },
      });

      expect(mockSupabase.eq).toHaveBeenCalledWith('order_status', 'COMPLETED');
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const orderData = {
        customer_name: 'John Doe',
        total_amount: 25.99,
        items: [
          {
            menu_item_id: 'item-1',
            item_name: 'Burger',
            quantity: 2,
            price: 12.99,
          },
        ],
      };

      const mockOrder = {
        id: 'order-1',
        venue_id: 'venue-1',
        ...orderData,
        order_status: 'PLACED',
        payment_status: 'UNPAID',
      };

      mockSupabase.single.mockResolvedValue({ data: mockOrder, error: null });

      const { supabaseServer } = await import('@/lib/supabase');
      vi.mocked(supabaseServer).mockResolvedValue(mockSupabase);

      Object.defineProperty(mockRequest, 'method', { value: 'POST', writable: true });
      mockRequest.json = vi.fn().mockResolvedValue(orderData);

      const response = await POST(mockRequest as NextRequest, {
        params: { venueId: 'venue-1' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.order).toEqual(mockOrder);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        customer_name: '',
        total_amount: -10,
      };

      Object.defineProperty(mockRequest, 'method', { value: 'POST', writable: true });
      mockRequest.json = vi.fn().mockResolvedValue(invalidData);

      const response = await POST(mockRequest as NextRequest, {
        params: { venueId: 'venue-1' },
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('should handle database errors', async () => {
      const orderData = {
        customer_name: 'John Doe',
        total_amount: 25.99,
        items: [],
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      const { supabaseServer } = await import('@/lib/supabase');
      vi.mocked(supabaseServer).mockResolvedValue(mockSupabase);

      Object.defineProperty(mockRequest, 'method', { value: 'POST', writable: true });
      mockRequest.json = vi.fn().mockResolvedValue(orderData);

      const response = await POST(mockRequest as NextRequest, {
        params: { venueId: 'venue-1' },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
    });
  });
});


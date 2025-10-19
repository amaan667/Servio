/**
 * OrderService Unit Tests
 * Tests for order business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '@/lib/services/OrderService';

// Mock Supabase client
vi.mock('@/lib/supabase/unified-client', () => ({
  createSupabaseClient: vi.fn(),
}));

// Mock cache
vi.mock('@/lib/cache', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    invalidate: vi.fn(),
  },
}));

describe('OrderService', () => {
  let orderService: OrderService;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    orderService = new OrderService();
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    };
  });

  describe('getOrders', () => {
    it('should fetch orders for a venue', async () => {
      const mockOrders = [
        {
          id: '1',
          venue_id: 'venue-1',
          order_status: 'PLACED',
          total_amount: 25.99,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockSupabase.limit.mockResolvedValue({ data: mockOrders, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const orders = await orderService.getOrders('venue-1');

      expect(orders).toEqual(mockOrders);
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    });

    it('should filter orders by status', async () => {
      mockSupabase.limit.mockResolvedValue({ data: [], error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      await orderService.getOrders('venue-1', { status: 'COMPLETED' });

      expect(mockSupabase.eq).toHaveBeenCalledWith('venue_id', 'venue-1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('order_status', 'COMPLETED');
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockSupabase.limit.mockResolvedValue({ data: null, error: mockError });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      await expect(orderService.getOrders('venue-1')).rejects.toThrow('Database error');
    });
  });

  describe('createOrder', () => {
    it('should create a new order', async () => {
      const orderData = {
        customer_name: 'John Doe',
        total_amount: 25.99,
        items: [],
      };

      const mockOrder = {
        id: 'order-1',
        venue_id: 'venue-1',
        ...orderData,
        order_status: 'PLACED',
        payment_status: 'UNPAID',
      };

      mockSupabase.single.mockResolvedValue({ data: mockOrder, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const order = await orderService.createOrder('venue-1', orderData);

      expect(order).toEqual(mockOrder);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          venue_id: 'venue-1',
          order_status: 'PLACED',
          payment_status: 'UNPAID',
        })
      );
    });

    it('should set default order status to PLACED', async () => {
      const orderData = {
        customer_name: 'John Doe',
        total_amount: 25.99,
        items: [],
      };

      mockSupabase.single.mockResolvedValue({ data: {}, error: null });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      await orderService.createOrder('venue-1', orderData);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          order_status: 'PLACED',
          payment_status: 'UNPAID',
        })
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockOrder = {
        id: 'order-1',
        venue_id: 'venue-1',
        order_status: 'READY',
      };

      const queryBuilder = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrder, error: null }),
      };

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(queryBuilder),
      });

      const { createSupabaseClient } = await import('@/lib/supabase/unified-client');
      vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);

      const order = await orderService.updateOrderStatus('order-1', 'venue-1', 'READY');

      expect(order.order_status).toBe('READY');
    });

    it('should throw error for invalid status', async () => {
      await expect(
        orderService.updateOrderStatus('order-1', 'venue-1', 'INVALID_STATUS')
      ).rejects.toThrow();
    });
  });
});


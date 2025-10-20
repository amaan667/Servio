/**
 * Tests for useMenuItems Hook
 * Ensures menu items management works correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMenuItems } from '@/hooks/useMenuItems';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseBrowser: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('useMenuItems', () => {
  const mockMenuItems = [
    {
      id: '1',
      venue_id: 'venue-123',
      name: 'Burger',
      description: 'Delicious burger',
      price: 12.99,
      category: 'Main',
      is_available: true,
      created_at: '2024-01-01T00:00:00Z',
      position: 0,
    },
    {
      id: '2',
      venue_id: 'venue-123',
      name: 'Fries',
      description: 'Crispy fries',
      price: 4.99,
      category: 'Sides',
      is_available: true,
      created_at: '2024-01-01T00:00:00Z',
      position: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch menu items on mount', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockMenuItems, error: null }),
            })),
          })),
        })),
      })),
    };

    const { supabaseBrowser } = await import('@/lib/supabase');
    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useMenuItems('venue-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.menuItems).toEqual(mockMenuItems);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
            })),
          })),
        })),
      })),
    };

    const { supabaseBrowser } = await import('@/lib/supabase');
    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useMenuItems('venue-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load menu items');
    expect(result.current.menuItems).toEqual([]);
  });

  it('should add menu item', async () => {
    const newItem = {
      venue_id: 'venue-123',
      name: 'Pizza',
      description: 'Delicious pizza',
      price: 15.99,
      category: 'Main',
      is_available: true,
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'menu_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({ data: mockMenuItems, error: null }),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: '3', ...newItem, created_at: '2024-01-01T00:00:00Z' },
                  error: null,
                }),
              })),
            })),
          };
        }
      }),
    };

    const { supabaseBrowser } = await import('@/lib/supabase');
    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useMenuItems('venue-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const addResult = await result.current.addMenuItem(newItem);

    expect(addResult.success).toBe(true);
    expect(result.current.menuItems).toHaveLength(3);
  });

  it('should update menu item', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockMenuItems, error: null }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { ...mockMenuItems[0], price: 14.99 },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    const { supabaseBrowser } = await import('@/lib/supabase');
    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useMenuItems('venue-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateResult = await result.current.updatePrice('1', 14.99);

    expect(updateResult.success).toBe(true);
    expect(result.current.menuItems[0].price).toBe(14.99);
  });

  it('should delete menu item', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockMenuItems, error: null }),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    };

    const { supabaseBrowser } = await import('@/lib/supabase');
    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useMenuItems('venue-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const deleteResult = await result.current.deleteMenuItem('1');

    expect(deleteResult.success).toBe(true);
    expect(result.current.menuItems).toHaveLength(1);
  });

  it('should toggle item availability', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockMenuItems, error: null }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { ...mockMenuItems[0], is_available: false },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    const { supabaseBrowser } = await import('@/lib/supabase');
    vi.mocked(supabaseBrowser).mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useMenuItems('venue-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const toggleResult = await result.current.toggleAvailability('1', false);

    expect(toggleResult.success).toBe(true);
    expect(result.current.menuItems[0].is_available).toBe(false);
  });
});


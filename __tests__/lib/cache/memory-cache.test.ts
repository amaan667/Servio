 
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memoryCache, cacheKeys } from '@/lib/cache/memory-cache';

describe('Memory Cache', () => {
  beforeEach(() => {
    memoryCache.clear();
  });

  it('should store and retrieve values', () => {
    const key = 'test-key';
    const value = { foo: 'bar' };
    
    memoryCache.set(key, value);
    const retrieved = memoryCache.get(key);
    
    expect(retrieved).toEqual(value);
  });

  it('should return null for non-existent keys', () => {
    const result = memoryCache.get('non-existent');
    expect(result).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    const key = 'expiring-key';
    const value = 'test-value';
    
    memoryCache.set(key, value, 100); // 100ms TTL
    expect(memoryCache.get(key)).toBe(value);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(memoryCache.get(key)).toBeNull();
  });

  it('should support getOrSet pattern', async () => {
    const key = 'lazy-key';
    const fetcher = vi.fn(async () => 'fetched-value');
    
    // First call should fetch
    const result1 = await memoryCache.getOrSet(key, fetcher);
    expect(result1).toBe('fetched-value');
    expect(fetcher).toHaveBeenCalledTimes(1);
    
    // Second call should use cache
    const result2 = await memoryCache.getOrSet(key, fetcher);
    expect(result2).toBe('fetched-value');
    expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should generate consistent cache keys', () => {
    const venueId = 'venue-123';
    expect(cacheKeys.menuItems(venueId)).toBe('menu:venue-123');
    expect(cacheKeys.dashboardCounts(venueId)).toBe('dashboard:venue-123:counts');
  });
});


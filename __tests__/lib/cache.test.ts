import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cache } from '@/lib/cache';

// Mock Redis
vi.mock('ioredis', () => {
  const Redis = vi.fn(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    mget: vi.fn(),
    pipeline: vi.fn(() => ({
      setex: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
    on: vi.fn(),
  }));
  return { default: Redis };
});

describe('Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get value from cache', async () => {
    const mockRedis = await import('ioredis');
    const redisInstance = new mockRedis.default();
    
    vi.mocked(redisInstance.get).mockResolvedValue(JSON.stringify({ test: 'value' }));
    
    const value = await cache.get<{ test: string }>('test-key');
    
    expect(value).toEqual({ test: 'value' });
    expect(redisInstance.get).toHaveBeenCalledWith('test-key');
  });

  it('should return null for non-existent key', async () => {
    const mockRedis = await import('ioredis');
    const redisInstance = new mockRedis.default();
    
    vi.mocked(redisInstance.get).mockResolvedValue(null);
    
    const value = await cache.get('non-existent-key');
    
    expect(value).toBeNull();
  });

  it('should set value in cache with TTL', async () => {
    const mockRedis = await import('ioredis');
    const redisInstance = new mockRedis.default();
    
    await cache.set('test-key', { test: 'value' }, 3600);
    
    expect(redisInstance.setex).toHaveBeenCalledWith(
      'test-key',
      3600,
      JSON.stringify({ test: 'value' })
    );
  });

  it('should delete key from cache', async () => {
    const mockRedis = await import('ioredis');
    const redisInstance = new mockRedis.default();
    
    await cache.delete('test-key');
    
    expect(redisInstance.del).toHaveBeenCalledWith('test-key');
  });
});


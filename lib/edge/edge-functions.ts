/**
 * @fileoverview Edge Functions for Global Distribution
 * Provides edge-optimized functions for low-latency responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/structured-logger';

/**
 * Edge function configuration
 */
export interface EdgeFunctionConfig {
  cacheTTL?: number; // Time to live in seconds
  staleWhileRevalidate?: number; // SWR time in seconds
  bypassCache?: boolean;
  region?: string;
}

/**
 * Edge response headers
 */
export interface EdgeResponseHeaders {
  'Cache-Control'?: string;
  'CDN-Cache-Control'?: string;
  'Edge-Cache-Tag'?: string;
  'X-Edge-Region'?: string;
  'X-Edge-Cache-Status'?: string;
}

/**
 * Edge function context
 */
export interface EdgeContext {
  request: NextRequest;
  region: string;
  cache: EdgeCache;
}

/**
 * Edge cache interface
 */
export interface EdgeCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Edge cache implementation using KV storage
 */
export class EdgeKVCache implements EdgeCache {
  private prefix = 'edge_cache_';

  async get(key: string): Promise<string | null> {
    try {
      // In production, this would use Cloudflare KV, Vercel KV, or similar
      // For now, we'll use a simple in-memory cache
      const cache = globalThis as typeof globalThis & {
        __edgeCache?: Map<string, { value: string; expires: number }>;
      };

      if (!cache.__edgeCache) {
        cache.__edgeCache = new Map();
      }

      const entry = cache.__edgeCache.get(this.prefix + key);
      if (!entry) {
        return null;
      }

      if (Date.now() > entry.expires) {
        cache.__edgeCache.delete(this.prefix + key);
        return null;
      }

      return entry.value;
    } catch (error) {
      logger.error('Edge cache get failed', { error, key });
      return null;
    }
  }

  async set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    try {
      const ttl = options?.ttl || 300; // Default 5 minutes
      const cache = globalThis as typeof globalThis & {
        __edgeCache?: Map<string, { value: string; expires: number }>;
      };

      if (!cache.__edgeCache) {
        cache.__edgeCache = new Map();
      }

      cache.__edgeCache.set(this.prefix + key, {
        value,
        expires: Date.now() + ttl * 1000,
      });
    } catch (error) {
      logger.error('Edge cache set failed', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cache = globalThis as typeof globalThis & {
        __edgeCache?: Map<string, { value: string; expires: number }>;
      };

      if (cache.__edgeCache) {
        cache.__edgeCache.delete(this.prefix + key);
      }
    } catch (error) {
      logger.error('Edge cache delete failed', { error, key });
    }
  }
}

/**
 * Create edge cache headers
 */
export function createEdgeCacheHeaders(config: EdgeFunctionConfig): EdgeResponseHeaders {
  const headers: EdgeResponseHeaders = {};

  if (config.cacheTTL) {
    headers['Cache-Control'] = `public, max-age=${config.cacheTTL}`;
  }

  if (config.staleWhileRevalidate) {
    headers['CDN-Cache-Control'] = `public, s-maxage=${config.cacheTTL || 300}, stale-while-revalidate=${config.staleWhileRevalidate}`;
  }

  if (config.region) {
    headers['X-Edge-Region'] = config.region;
  }

  return headers;
}

/**
 * Edge function wrapper
 */
export function withEdgeFunction<T>(
  handler: (context: EdgeContext) => Promise<NextResponse>,
  config: EdgeFunctionConfig = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const region = config.region || getEdgeRegion();
    const cache = new EdgeKVCache();

    const context: EdgeContext = {
      request,
      region,
      cache,
    };

    try {
      // Check cache if not bypassing
      if (!config.bypassCache) {
        const cacheKey = generateCacheKey(request);
        const cached = await cache.get(cacheKey);

        if (cached) {
          const response = NextResponse.json(JSON.parse(cached), {
            headers: {
              ...createEdgeCacheHeaders(config),
              'X-Edge-Cache-Status': 'HIT',
            },
          });

          logger.debug('Edge cache hit', { cacheKey, region });
          return response;
        }
      }

      // Execute handler
      const response = await handler(context);

      // Cache response if successful
      if (response.ok && !config.bypassCache && config.cacheTTL) {
        const cacheKey = generateCacheKey(request);
        const body = await response.clone().text();

        await cache.set(cacheKey, body, { ttl: config.cacheTTL });

        response.headers.set('X-Edge-Cache-Status', 'MISS');
      }

      // Add edge headers
      const edgeHeaders = createEdgeCacheHeaders(config);
      Object.entries(edgeHeaders).forEach(([key, value]) => {
        if (value) {
          response.headers.set(key, value);
        }
      });

      const duration = Date.now() - startTime;
      logger.info('Edge function executed', { region, duration });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Edge function failed', { error, region, duration });

      return NextResponse.json(
        { error: 'Internal server error' },
        {
          status: 500,
          headers: {
            'X-Edge-Region': region,
            'X-Edge-Cache-Status': 'ERROR',
          },
        }
      );
    }
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(request: NextRequest): string {
  const url = new URL(request.url);
  const method = request.method;
  const headers = request.headers.get('authorization') || '';

  return `${method}:${url.pathname}:${url.search}:${headers.substring(0, 16)}`;
}

/**
 * Get edge region
 */
function getEdgeRegion(): string {
  // In production, this would detect the actual edge region
  // For now, return a default
  return process.env.EDGE_REGION || 'us-east-1';
}

/**
 * Edge function for menu items (highly cacheable)
 */
export async function edgeGetMenuItems(context: EdgeContext): Promise<NextResponse> {
  const { request } = context;
  const url = new URL(request.url);
  const venueId = url.searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json({ error: 'Missing venueId' }, { status: 400 });
  }

  // Fetch menu items from database
  // This is a placeholder - implement actual data fetching
  const menuItems = {
    venueId,
    items: [],
    cachedAt: new Date().toISOString(),
  };

  return NextResponse.json(menuItems);
}

/**
 * Edge function for venue info (highly cacheable)
 */
export async function edgeGetVenueInfo(context: EdgeContext): Promise<NextResponse> {
  const { request } = context;
  const url = new URL(request.url);
  const venueId = url.searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json({ error: 'Missing venueId' }, { status: 400 });
  }

  // Fetch venue info from database
  // This is a placeholder - implement actual data fetching
  const venueInfo = {
    venueId,
    name: 'Sample Venue',
    cachedAt: new Date().toISOString(),
  };

  return NextResponse.json(venueInfo);
}

/**
 * Edge function for public menu (highly cacheable)
 */
export async function edgeGetPublicMenu(context: EdgeContext): Promise<NextResponse> {
  const { request } = context;
  const url = new URL(request.url);
  const venueId = url.searchParams.get('venueId');

  if (!venueId) {
    return NextResponse.json({ error: 'Missing venueId' }, { status: 400 });
  }

  // Fetch public menu from database
  // This is a placeholder - implement actual data fetching
  const publicMenu = {
    venueId,
    categories: [],
    items: [],
    cachedAt: new Date().toISOString(),
  };

  return NextResponse.json(publicMenu);
}

/**
 * Edge function for health check (always fast)
 */
export async function edgeHealthCheck(context: EdgeContext): Promise<NextResponse> {
  const { region } = context;

  return NextResponse.json({
    status: 'healthy',
    region,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Edge function for CDN cache invalidation
 */
export async function edgeInvalidateCache(context: EdgeContext): Promise<NextResponse> {
  const { request, cache } = context;
  const url = new URL(request.url);
  const cacheKey = url.searchParams.get('key');

  if (!cacheKey) {
    return NextResponse.json({ error: 'Missing cache key' }, { status: 400 });
  }

  await cache.delete(cacheKey);

  return NextResponse.json({
    success: true,
    invalidated: cacheKey,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Edge function for batch requests (reduce round trips)
 */
export async function edgeBatchRequests(context: EdgeContext): Promise<NextResponse> {
  const { request } = context;
  const body = await request.json();

  if (!Array.isArray(body.requests)) {
    return NextResponse.json({ error: 'Invalid batch request' }, { status: 400 });
  }

  // Process batch requests
  const responses = await Promise.all(
    body.requests.map(async (req: { id: string; [key: string]: unknown }) => {
      // Process each request
      // This is a placeholder - implement actual request processing
      return {
        id: req.id,
        data: null,
      };
    })
  );

  return NextResponse.json({ responses });
}

/**
 * Edge function for geolocation-based routing
 */
export async function edgeGeoRouting(context: EdgeContext): Promise<NextResponse> {
  const { request } = context;

  // Get client IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  // Get country from IP (placeholder)
  const country = request.headers.get('cf-ipcountry') || 'US';

  // Route to nearest region
  const region = getNearestRegion(country);

  return NextResponse.json({
    ip,
    country,
    region,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get nearest region based on country
 */
function getNearestRegion(country: string): string {
  const regionMap: Record<string, string> = {
    US: 'us-east-1',
    CA: 'us-east-1',
    GB: 'eu-west-1',
    DE: 'eu-central-1',
    FR: 'eu-west-1',
    AU: 'ap-southeast-2',
    JP: 'ap-northeast-1',
    SG: 'ap-southeast-1',
  };

  return regionMap[country] || 'us-east-1';
}

/**
 * Edge function for A/B testing
 */
export async function edgeABTest(context: EdgeContext): Promise<NextResponse> {
  const { request } = context;
  const url = new URL(request.url);
  const experimentId = url.searchParams.get('experiment');

  if (!experimentId) {
    return NextResponse.json({ error: 'Missing experiment ID' }, { status: 400 });
  }

  // Get user ID for consistent bucketing
  const userId = request.headers.get('x-user-id') || generateAnonymousUserId();

  // Assign to variant
  const variant = assignVariant(userId, experimentId);

  return NextResponse.json({
    experimentId,
    variant,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Generate anonymous user ID
 */
function generateAnonymousUserId(): string {
  return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Assign variant to user
 */
function assignVariant(userId: string, experimentId: string): string {
  const hash = hashString(`${userId}:${experimentId}`);
  const variants = ['control', 'variant_a', 'variant_b'];
  const variant = variants[hash % variants.length];
  return variant || 'control';
}

/**
 * Simple hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

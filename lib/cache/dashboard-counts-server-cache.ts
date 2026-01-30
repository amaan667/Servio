/**
 * Server-side short TTL cache for dashboard counts.
 * Reduces DB load from repeated GET /api/dashboard/counts for the same venue.
 */

const TTL_MS = 15_000; // 15 seconds

interface Entry {
  data: Record<string, unknown>;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

function cacheKey(venueId: string, tz: string, liveWindowMins: number): string {
  return `${venueId}|${tz}|${liveWindowMins}`;
}

export function getCachedDashboardCounts(
  venueId: string,
  tz: string,
  liveWindowMins: number
): Record<string, unknown> | null {
  const key = cacheKey(venueId, tz, liveWindowMins);
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedDashboardCounts(
  venueId: string,
  tz: string,
  liveWindowMins: number,
  data: Record<string, unknown>
): void {
  const key = cacheKey(venueId, tz, liveWindowMins);
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
  // Prevent unbounded growth: keep only recent keys (simple cleanup)
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt < now) cache.delete(k);
    }
  }
}

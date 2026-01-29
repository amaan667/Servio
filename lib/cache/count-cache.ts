/**
 * Shared count cache utility
 * Ensures counts persist across navigation and prevents unnecessary refreshes
 */

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes - counts don't need to be super fresh
const CACHE_KEY_PREFIX = "dashboard_counts_";
const CACHE_TIME_KEY_PREFIX = "dashboard_counts_time_";

export interface CachedCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  tables_in_use?: number;
  tables_reserved_now?: number;
  in_use_now?: number;
  reserved_now?: number;
  reserved_later?: number;
  waiting?: number;
}

/**
 * Get cached counts for a venue
 */
export function getCachedCounts(venueId: string): CachedCounts | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${venueId}`);
    const cacheTime = sessionStorage.getItem(`${CACHE_TIME_KEY_PREFIX}${venueId}`);

    if (!cached || !cacheTime) return null;

    const age = Date.now() - parseInt(cacheTime, 10);
    if (age > CACHE_DURATION_MS) {
      // Cache expired, but return it anyway to prevent flicker
      // The component can refresh in background
      return JSON.parse(cached);
    }

    return JSON.parse(cached);
  } catch {
    return null;
  }
}

/**
 * Set cached counts for a venue
 * Accepts partial counts and fills in defaults for missing values
 */
export function setCachedCounts(
  venueId: string,
  counts: Partial<CachedCounts> & { live_count?: number; today_orders_count?: number }
): void {
  if (typeof window === "undefined") return;

  try {
    // Ensure all required fields have defaults
    const fullCounts: CachedCounts = {
      live_count: counts.live_count ?? 0,
      earlier_today_count: counts.earlier_today_count ?? 0,
      history_count: counts.history_count ?? 0,
      today_orders_count: counts.today_orders_count ?? 0,
      active_tables_count: counts.active_tables_count ?? 0,
      tables_set_up: counts.tables_set_up ?? 0,
      tables_in_use: counts.tables_in_use,
      tables_reserved_now: counts.tables_reserved_now,
      in_use_now: counts.in_use_now,
      reserved_now: counts.reserved_now,
      reserved_later: counts.reserved_later,
      waiting: counts.waiting,
    };
    sessionStorage.setItem(`${CACHE_KEY_PREFIX}${venueId}`, JSON.stringify(fullCounts));
    sessionStorage.setItem(`${CACHE_TIME_KEY_PREFIX}${venueId}`, Date.now().toString());
  } catch (error) {
    // SessionStorage might be full or unavailable
  }
}

/**
 * Check if cached counts are fresh (less than cache duration old)
 */
export function isCacheFresh(venueId: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cacheTime = sessionStorage.getItem(`${CACHE_TIME_KEY_PREFIX}${venueId}`);
    if (!cacheTime) return false;

    const age = Date.now() - parseInt(cacheTime, 10);
    return age < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Clear cached counts for a venue (useful when switching venues)
 */
export function clearCachedCounts(venueId: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${venueId}`);
    sessionStorage.removeItem(`${CACHE_TIME_KEY_PREFIX}${venueId}`);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all cached counts (useful on logout)
 */
export function clearAllCachedCounts(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(CACHE_TIME_KEY_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore errors
  }
}

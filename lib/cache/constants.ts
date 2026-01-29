/**
 * Cache Constants
 *
 * Standardized cache keys, TTLs, and tags for consistent caching across the application.
 * Use these constants instead of hardcoding cache keys and TTLs.
 */

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  // Short-lived cache (frequently changing data)
  SHORT: 30, // 30 seconds - for live orders, real-time data
  VERY_SHORT: 10, // 10 seconds - for extremely dynamic data

  // Medium cache (moderately changing data)
  MEDIUM: 300, // 5 minutes - for dashboard counts, recent orders
  MEDIUM_LONG: 600, // 10 minutes - for menu items, tables

  // Long cache (rarely changing data)
  LONG: 1800, // 30 minutes - for venue settings, staff list
  VERY_LONG: 3600, // 1 hour - for static configuration

  // Extended cache (rarely changes)
  EXTENDED: 7200, // 2 hours - for subscription info, tier data
} as const;

/**
 * Cache key prefixes
 */
export const CACHE_PREFIX = {
  VENUE: "venue",
  USER: "user",
  ORDER: "order",
  MENU: "menu",
  TABLE: "table",
  STAFF: "staff",
  INVENTORY: "inventory",
  KDS: "kds",
  DASHBOARD: "dashboard",
  ANALYTICS: "analytics",
  SUBSCRIPTION: "subscription",
} as const;

/**
 * Standardized cache key builders
 */
export const cacheKeys = {
  /**
   * Venue-related cache keys
   */
  venue: {
    details: (venueId: string) => `${CACHE_PREFIX.VENUE}:${venueId}:details`,
    settings: (venueId: string) => `${CACHE_PREFIX.VENUE}:${venueId}:settings`,
    tier: (venueId: string) => `${CACHE_PREFIX.VENUE}:${venueId}:tier`,
  },

  /**
   * Order-related cache keys
   */
  order: {
    list: (venueId: string, filters?: Record<string, unknown>) =>
      `${CACHE_PREFIX.ORDER}:${venueId}:list:${JSON.stringify(filters || {})}`,
    live: (venueId: string) => `${CACHE_PREFIX.ORDER}:${venueId}:live`,
    dashboard: (venueId: string, status?: string, scope?: string) =>
      `${CACHE_PREFIX.ORDER}:${venueId}:dashboard:${status || "all"}:${scope || "live"}`,
    pos: (venueId: string) => `${CACHE_PREFIX.ORDER}:${venueId}:pos`,
    byId: (orderId: string) => `${CACHE_PREFIX.ORDER}:${orderId}`,
  },

  /**
   * Menu-related cache keys
   */
  menu: {
    items: (venueId: string) => `${CACHE_PREFIX.MENU}:${venueId}:items`,
    categories: (venueId: string) => `${CACHE_PREFIX.MENU}:${venueId}:categories`,
    categoryOrder: (venueId: string) => `${CACHE_PREFIX.MENU}:${venueId}:category-order`,
  },

  /**
   * Table-related cache keys
   */
  table: {
    list: (venueId: string) => `${CACHE_PREFIX.TABLE}:${venueId}:list`,
    sessions: (venueId: string) => `${CACHE_PREFIX.TABLE}:${venueId}:sessions`,
    reservations: (venueId: string) => `${CACHE_PREFIX.TABLE}:${venueId}:reservations`,
  },

  /**
   * Dashboard-related cache keys
   */
  dashboard: {
    counts: (venueId: string, tz?: string) =>
      `${CACHE_PREFIX.DASHBOARD}:${venueId}:counts${tz ? `:${tz}` : ""}`,
    stats: (venueId: string, period?: string) =>
      `${CACHE_PREFIX.DASHBOARD}:${venueId}:stats:${period || "today"}`,
  },

  /**
   * Inventory-related cache keys
   */
  inventory: {
    items: (venueId: string) => `${CACHE_PREFIX.INVENTORY}:${venueId}:items`,
    lowStock: (venueId: string) => `${CACHE_PREFIX.INVENTORY}:${venueId}:low-stock`,
    movements: (venueId: string, filters?: Record<string, unknown>) =>
      `${CACHE_PREFIX.INVENTORY}:${venueId}:movements:${JSON.stringify(filters || {})}`,
  },

  /**
   * KDS-related cache keys
   */
  kds: {
    stations: (venueId: string) => `${CACHE_PREFIX.KDS}:${venueId}:stations`,
    tickets: (venueId: string, stationId?: string) =>
      `${CACHE_PREFIX.KDS}:${venueId}:tickets${stationId ? `:${stationId}` : ""}`,
  },

  /**
   * Staff-related cache keys
   */
  staff: {
    list: (venueId: string) => `${CACHE_PREFIX.STAFF}:${venueId}:list`,
    shifts: (venueId: string, date?: string) =>
      `${CACHE_PREFIX.STAFF}:${venueId}:shifts${date ? `:${date}` : ""}`,
  },

  /**
   * User-related cache keys
   */
  user: {
    venues: (userId: string) => `${CACHE_PREFIX.USER}:${userId}:venues`,
    profile: (userId: string) => `${CACHE_PREFIX.USER}:${userId}:profile`,
  },

  /**
   * Subscription-related cache keys
   */
  subscription: {
    status: (orgId: string) => `${CACHE_PREFIX.SUBSCRIPTION}:${orgId}:status`,
    tier: (orgId: string) => `${CACHE_PREFIX.SUBSCRIPTION}:${orgId}:tier`,
  },
} as const;

/**
 * Cache tags for invalidation
 */
export const cacheTags = {
  venue: (venueId: string) => `venue:${venueId}`,
  user: (userId: string) => `user:${userId}`,
  order: (venueId: string) => `order:${venueId}`,
  menu: (venueId: string) => `menu:${venueId}`,
  table: (venueId: string) => `table:${venueId}`,
  staff: (venueId: string) => `staff:${venueId}`,
  inventory: (venueId: string) => `inventory:${venueId}`,
  kds: (venueId: string) => `kds:${venueId}`,
  dashboard: (venueId: string) => `dashboard:${venueId}`,
  subscription: (orgId: string) => `subscription:${orgId}`,
} as const;

/**
 * Recommended TTLs for different data types
 */
export const RECOMMENDED_TTL = {
  // Real-time data - very short TTL
  LIVE_ORDERS: CACHE_TTL.SHORT,
  TABLE_SESSIONS: CACHE_TTL.SHORT,
  DASHBOARD_COUNTS: CACHE_TTL.MEDIUM,

  // Frequently accessed but less dynamic
  MENU_ITEMS: CACHE_TTL.MEDIUM_LONG,
  TABLES: CACHE_TTL.MEDIUM_LONG,
  STAFF_LIST: CACHE_TTL.LONG,

  // Rarely changing
  VENUE_SETTINGS: CACHE_TTL.LONG,
  SUBSCRIPTION: CACHE_TTL.EXTENDED,
  TIER_INFO: CACHE_TTL.EXTENDED,

  // Dashboard and analytics
  DASHBOARD_STATS: CACHE_TTL.MEDIUM,
  ANALYTICS: CACHE_TTL.MEDIUM_LONG,
} as const;

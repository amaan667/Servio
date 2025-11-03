/**
 * @fileoverview Feature flags system for gradual rollouts
 * @module lib/feature-flags
 */

import { logger } from "@/lib/logger";
import { redisCache } from "@/lib/cache/redis-cache";

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  enabledFor: {
    userIds?: string[];
    venueIds?: string[];
    emails?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Feature flags manager
 */
export class FeatureFlagsManager {
  private static flags: Map<string, FeatureFlag> = new Map();
  private static readonly CACHE_KEY = "feature-flags";
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Initialize feature flags
   */
  static async initialize() {
    // Try to load from cache
    const cached = await redisCache.get<FeatureFlag[]>(this.CACHE_KEY);
    if (cached) {
      cached.forEach((flag) => this.flags.set(flag.key, flag));
      return;
    }

    // Load default flags
    this.setDefaultFlags();

    // Cache the flags
    await redisCache.set(this.CACHE_KEY, Array.from(this.flags.values()), { ttl: this.CACHE_TTL });

  }

  /**
   * Set default feature flags
   */
  private static setDefaultFlags() {
    const defaults: FeatureFlag[] = [
      {
        key: "ai_assistant",
        name: "AI Assistant",
        description: "Enable AI-powered restaurant management assistant",
        enabled: true,
        rolloutPercentage: 100,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "advanced_analytics",
        name: "Advanced Analytics",
        description: "Enable advanced analytics dashboard with predictive insights",
        enabled: false,
        rolloutPercentage: 0,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "inventory_forecasting",
        name: "Inventory Forecasting",
        description: "AI-powered inventory forecasting and auto-ordering",
        enabled: false,
        rolloutPercentage: 10,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "multi_location",
        name: "Multi-Location Support",
        description: "Manage multiple restaurant locations from one account",
        enabled: true,
        rolloutPercentage: 100,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "customer_loyalty",
        name: "Customer Loyalty Program",
        description: "Built-in customer loyalty and rewards system",
        enabled: false,
        rolloutPercentage: 0,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "online_ordering",
        name: "Online Ordering",
        description: "Direct online ordering without QR codes",
        enabled: true,
        rolloutPercentage: 100,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "table_reservations",
        name: "Table Reservations",
        description: "Online table reservation system",
        enabled: true,
        rolloutPercentage: 100,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        key: "kitchen_display",
        name: "Kitchen Display System",
        description: "Real-time kitchen display for order management",
        enabled: true,
        rolloutPercentage: 100,
        enabledFor: {
          /* Empty */
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    defaults.forEach((flag) => this.flags.set(flag.key, flag));
  }

  /**
   * Check if feature is enabled for a specific context
   */
  static isEnabled(
    flagKey: string,
    context?: {
      userId?: string;
      venueId?: string;
      email?: string;
    }
  ): boolean {
    const flag = this.flags.get(flagKey);

    if (!flag) {
      return false;
    }

    // If globally disabled, return false
    if (!flag.enabled) {
      return false;
    }

    // Check specific enablement
    if (context) {
      if (context.userId && flag.enabledFor.userIds?.includes(context.userId)) {
        return true;
      }
      if (context.venueId && flag.enabledFor.venueIds?.includes(context.venueId)) {
        return true;
      }
      if (context.email && flag.enabledFor.emails?.includes(context.email)) {
        return true;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    if (flag.rolloutPercentage <= 0) {
      return false;
    }

    // Consistent hash-based rollout
    const identifier = context?.userId || context?.venueId || context?.email || "anonymous";
    const hash = this.simpleHash(identifier + flagKey);
    const bucket = hash % 100;

    return bucket < flag.rolloutPercentage;
  }

  /**
   * Get all enabled features for a context
   */
  static getEnabledFeatures(context?: {
    userId?: string;
    venueId?: string;
    email?: string;
  }): string[] {
    const enabled: string[] = [];

    for (const [key, flag] of this.flags.entries()) {
      if (this.isEnabled(key, context)) {
        enabled.push(flag.name);
      }
    }

    return enabled;
  }

  /**
   * Get all feature flags (admin)
   */
  static getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Update a feature flag
   */
  static async updateFlag(flagKey: string, updates: Partial<FeatureFlag>): Promise<boolean> {
    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    const updated = {
      ...flag,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.flags.set(flagKey, updated);

    // Update cache
    await redisCache.set(this.CACHE_KEY, Array.from(this.flags.values()), { ttl: this.CACHE_TTL });


    return true;
  }

  /**
   * Simple hash function for consistent bucketing
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create a new feature flag
   */
  static async createFlag(flag: Omit<FeatureFlag, "createdAt" | "updatedAt">): Promise<void> {
    const now = new Date().toISOString();
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: now,
      updatedAt: now,
    };

    this.flags.set(flag.key, newFlag);

    // Update cache
    await redisCache.set(this.CACHE_KEY, Array.from(this.flags.values()), { ttl: this.CACHE_TTL });

  }

  /**
   * Delete a feature flag
   */
  static async deleteFlag(flagKey: string): Promise<boolean> {
    const deleted = this.flags.delete(flagKey);

    if (deleted) {
      // Update cache
      await redisCache.set(this.CACHE_KEY, Array.from(this.flags.values()), {
        ttl: this.CACHE_TTL,
      });
    }

    return deleted;
  }
}

// Initialize on import
if (typeof window === "undefined") {
  FeatureFlagsManager.initialize().catch((error) => {
    logger.error("[FEATURE_FLAGS] Failed to initialize", { error });
  });
}

// Export convenience function
export const isFeatureEnabled = (
  flagKey: string,
  context?: { userId?: string; venueId?: string; email?: string }
) => FeatureFlagsManager.isEnabled(flagKey, context);

/**
 * @fileoverview Feature flags system for gradual rollouts
 * @module lib/feature-flags
 */

import { redisCache } from "@/lib/cache/redis-cache";

export interface FeatureFlag {

  };

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

        },

      },
      {

        },

      },
      {

        },

      },
      {

        },

      },
      {

        },

      },
      {

        },

      },
      {

        },

      },
      {

        },

      },
    ];

    defaults.forEach((flag) => this.flags.set(flag.key, flag));
  }

  /**
   * Check if feature is enabled for a specific context
   */
  static isEnabled(

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

    }

    return deleted;
  }
}

// Initialize on import
if (typeof window === "undefined") {
  FeatureFlagsManager.initialize().catch((error) => {

}

// Export convenience function
export const isFeatureEnabled = (

  context?: { userId?: string; venueId?: string; email?: string }
) => FeatureFlagsManager.isEnabled(flagKey, context);

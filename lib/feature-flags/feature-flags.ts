/**
 * @fileoverview Feature Flags System
 * Provides gradual rollout and A/B testing capabilities
 */

import React from "react";
import { cache } from "@/lib/cache";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number; // 0-100, for gradual rollout
  conditions?: FeatureFlagCondition[];
}

export interface FeatureFlagCondition {
  type: "user_id" | "venue_id" | "tier" | "role" | "custom";
  operator: "equals" | "not_equals" | "in" | "not_in" | "contains";
  value: string | string[];
}

export interface FeatureFlagContext {
  userId?: string;
  venueId?: string;
  tier?: string;
  role?: string;
  custom?: Record<string, unknown>;
}

/**
 * Feature Flags Configuration
 * Add new feature flags here
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // AI Features
  AI_ASSISTANT: {
    name: "AI Assistant",
    enabled: true,
    description: "AI-powered assistant for restaurant operations",
    rolloutPercentage: 100,
  },
  AI_MENU_OPTIMIZATION: {
    name: "AI Menu Optimization",
    enabled: true,
    description: "AI suggestions for menu optimization",
    rolloutPercentage: 50, // Gradual rollout
  },

  // Order Features
  BULK_ORDER_ACTIONS: {
    name: "Bulk Order Actions",
    enabled: true,
    description: "Bulk complete/cancel orders",
    rolloutPercentage: 100,
  },
  ORDER_NOTIFICATIONS: {
    name: "Order Notifications",
    enabled: true,
    description: "Real-time order notifications",
    rolloutPercentage: 100,
  },

  // Menu Features
  MENU_ANALYTICS: {
    name: "Menu Analytics",
    enabled: true,
    description: "Advanced menu performance analytics",
    rolloutPercentage: 100,
  },
  MENU_BULK_EDIT: {
    name: "Menu Bulk Edit",
    enabled: true,
    description: "Bulk edit menu items",
    rolloutPercentage: 100,
  },

  // Table Features
  TABLE_RESERVATIONS: {
    name: "Table Reservations",
    enabled: true,
    description: "Table reservation system",
    rolloutPercentage: 100,
  },
  TABLE_AUTO_ASSIGN: {
    name: "Table Auto-Assign",
    enabled: false,
    description: "Automatically assign tables to orders",
    rolloutPercentage: 0,
  },

  // Inventory Features
  INVENTORY_LOW_STOCK_ALERTS: {
    name: "Inventory Low Stock Alerts",
    enabled: true,
    description: "Alerts when inventory is low",
    rolloutPercentage: 100,
  },
  INVENTORY_AUTO_REORDER: {
    name: "Inventory Auto-Reorder",
    enabled: false,
    description: "Automatically create reorder requests",
    rolloutPercentage: 0,
  },

  // Payment Features
  PAYMENT_SAVED_CARDS: {
    name: "Saved Payment Methods",
    enabled: true,
    description: "Save payment methods for faster checkout",
    rolloutPercentage: 100,
  },
  PAYMENT_SPLIT: {
    name: "Split Payment",
    enabled: false,
    description: "Split payment across multiple methods",
    rolloutPercentage: 0,
  },

  // Analytics Features
  ADVANCED_ANALYTICS: {
    name: "Advanced Analytics",
    enabled: true,
    description: "Advanced analytics and reporting",
    rolloutPercentage: 100,
    conditions: [
      {
        type: "tier",
        operator: "in",
        value: ["pro", "enterprise"],
      },
    ],
  },
  REALTIME_DASHBOARD: {
    name: "Realtime Dashboard",
    enabled: true,
    description: "Real-time dashboard updates",
    rolloutPercentage: 100,
  },

  // Staff Features
  STAFF_SCHEDULING: {
    name: "Staff Scheduling",
    enabled: false,
    description: "Staff scheduling and time tracking",
    rolloutPercentage: 0,
  },
  STAFF_PERFORMANCE: {
    name: "Staff Performance",
    enabled: false,
    description: "Staff performance metrics",
    rolloutPercentage: 0,
  },

  // KDS Features
  KDS_CUSTOM_STATIONS: {
    name: "KDS Custom Stations",
    enabled: true,
    description: "Custom KDS station configuration",
    rolloutPercentage: 100,
  },
  KDS_VOICE_NOTIFICATIONS: {
    name: "KDS Voice Notifications",
    enabled: false,
    description: "Voice notifications for KDS",
    rolloutPercentage: 0,
  },
};

/**
 * Feature Flags Manager
 */
export class FeatureFlagsManager {
  private cache = cache;

  /**
   * Check if a feature flag is enabled
   */
  async isEnabled(
    flagName: string,
    context?: FeatureFlagContext
  ): Promise<boolean> {
    const flag = FEATURE_FLAGS[flagName];

    if (!flag) {
      // Feature flag not found - silently return false
      return false;
    }

    // Check if flag is globally enabled
    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashContext(flagName, context);
      const rolloutValue = hash % 100;
      if (rolloutValue >= flag.rolloutPercentage) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions && context) {
      const conditionsMet = this.checkConditions(flag.conditions, context);
      if (!conditionsMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check multiple feature flags at once
   */
  async areEnabled(
    flagNames: string[],
    context?: FeatureFlagContext
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      flagNames.map(async (name) => {
        results[name] = await this.isEnabled(name, context);
      })
    );

    return results;
  }

  /**
   * Get all enabled flags for a context
   */
  async getEnabledFlags(
    context?: FeatureFlagContext
  ): Promise<string[]> {
    const enabled: string[] = [];

    for (const [name] of Object.entries(FEATURE_FLAGS)) {
      const isEnabled = await this.isEnabled(name, context);
      if (isEnabled) {
        enabled.push(name);
      }
    }

    return enabled;
  }

  /**
   * Check if conditions are met
   */
  private checkConditions(
    conditions: FeatureFlagCondition[],
    context: FeatureFlagContext
  ): boolean {
    return conditions.every((condition) => {
      const contextValue = this.getContextValue(condition.type, context);

      switch (condition.operator) {
        case "equals":
          return contextValue === condition.value;
        case "not_equals":
          return contextValue !== condition.value;
        case "in":
          return Array.isArray(condition.value) &&
            contextValue !== undefined &&
            condition.value.includes(contextValue);
        case "not_in":
          return Array.isArray(condition.value) &&
            contextValue !== undefined &&
            !condition.value.includes(contextValue);
        case "contains":
          return typeof contextValue === "string" &&
            contextValue.includes(condition.value as string);
        default:
          return false;
      }
    });
  }

  /**
   * Get context value for condition type
   */
  private getContextValue(
    type: FeatureFlagCondition["type"],
    context?: FeatureFlagContext
  ): string | undefined {
    if (!context) return undefined;

    switch (type) {
      case "user_id":
        return context.userId;
      case "venue_id":
        return context.venueId;
      case "tier":
        return context.tier;
      case "role":
        return context.role;
      case "custom":
        return context.custom ? String(context.custom) : undefined;
      default:
        return undefined;
    }
  }

  /**
   * Hash context for consistent rollout
   */
  private hashContext(flagName: string, context?: FeatureFlagContext): number {
    const input = `${flagName}:${context?.userId || "anonymous"}:${context?.venueId || "none"}`;

    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }

  /**
   * Override a feature flag (for testing)
   */
  async override(flagName: string, enabled: boolean): Promise<void> {
    const cacheKey = `feature_flag:${flagName}`;
    await this.cache.set(cacheKey, enabled, { ttl: 3600 }); // 1 hour
  }

  /**
   * Clear feature flag override
   */
  async clearOverride(flagName: string): Promise<void> {
    const cacheKey = `feature_flag:${flagName}`;
    await this.cache.delete(cacheKey);
  }

  /**
   * Get feature flag details
   */
  getFlag(flagName: string): FeatureFlag | undefined {
    return FEATURE_FLAGS[flagName];
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): Record<string, FeatureFlag> {
    return FEATURE_FLAGS;
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagsManager();

/**
 * React hook for feature flags
 */
export function useFeatureFlag(
  flagName: string,
  context?: FeatureFlagContext
): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    featureFlags.isEnabled(flagName, context).then((result) => {
      setEnabled(result);
      setLoading(false);
    });
  }, [flagName, JSON.stringify(context)]);

  return { enabled, loading };
}

/**
 * React hook for multiple feature flags
 */
export function useFeatureFlags(
  flagNames: string[],
  context?: FeatureFlagContext
): { flags: Record<string, boolean>; loading: boolean } {
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    featureFlags.areEnabled(flagNames, context).then((result) => {
      setFlags(result);
      setLoading(false);
    });
  }, [JSON.stringify(flagNames), JSON.stringify(context)]);

  return { flags, loading };
}

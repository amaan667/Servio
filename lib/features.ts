/**
 * Feature Flags System
 *
 * UNLOCK-style feature flags for gradual rollouts and experimental features.
 * Flags are checked server-side and can be overridden per-venue or per-user.
 */

import { createServerSupabase } from "@/lib/supabase";

export type FeatureFlag =
  | "experimental_ai_matching"
  | "beta_multi_language"
  | "new_menu_extraction_v2"
  | "advanced_analytics"
  | "custom_branding"
  | "api_v2_endpoints";

export interface FeatureConfig {
  name: FeatureFlag;
  description: string;
  defaultEnabled: boolean;
  tierRequired?: "starter" | "pro" | "enterprise";
  rolloutPercent?: number; // 0-100, random rollout
}

// Feature definitions
export const FEATURES: Record<FeatureFlag, FeatureConfig> = {
  experimental_ai_matching: {
    name: "experimental_ai_matching",
    description: "Use experimental AI for menu item matching",
    defaultEnabled: false,
    tierRequired: "pro",
    rolloutPercent: 10,
  },
  beta_multi_language: {
    name: "beta_multi_language",
    description: "Beta support for multi-language menus",
    defaultEnabled: false,
    tierRequired: "enterprise",
  },
  new_menu_extraction_v2: {
    name: "new_menu_extraction_v2",
    description: "Version 2 of menu extraction with improved accuracy",
    defaultEnabled: true,
    rolloutPercent: 50,
  },
  advanced_analytics: {
    name: "advanced_analytics",
    description: "Advanced analytics and reporting features",
    defaultEnabled: false,
    tierRequired: "enterprise",
  },
  custom_branding: {
    name: "custom_branding",
    description: "Custom white-label branding options",
    defaultEnabled: false,
    tierRequired: "pro",
  },
  api_v2_endpoints: {
    name: "api_v2_endpoints",
    description: "Access to API version 2 endpoints",
    defaultEnabled: false,
  },
};

// In-memory cache for feature flags (refreshes every 60s)
const featureCache = new Map<string, { value: boolean; expires: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Check if a feature is enabled
 */
export async function isEnabled(
  feature: FeatureFlag,
  options?: { venueId?: string; userId?: string }
): Promise<boolean> {
  const config = FEATURES[feature];
  if (!config) {
    return false;
  }

  const cacheKey = `${feature}:${options?.venueId ?? "global"}:${options?.userId ?? "none"}`;
  const cached = featureCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  let enabled = config.defaultEnabled;

  try {
    const supabase = await createServerSupabase();

    // Check venue-specific override
    if (options?.venueId) {
      const { data: override } = await supabase
        .from("feature_flag_overrides")
        .select("enabled")
        .eq("feature", feature)
        .eq("venue_id", options.venueId)
        .single();

      if (override) {
        enabled = override.enabled;
        featureCache.set(cacheKey, { value: enabled, expires: Date.now() + CACHE_TTL });
        return enabled;
      }
    }

    // Check user-specific override
    if (options?.userId) {
      const { data: override } = await supabase
        .from("feature_flag_overrides")
        .select("enabled")
        .eq("feature", feature)
        .eq("user_id", options.userId)
        .single();

      if (override) {
        enabled = override.enabled;
        featureCache.set(cacheKey, { value: enabled, expires: Date.now() + CACHE_TTL });
        return enabled;
      }
    }

    // Check tier requirement
    if (config.tierRequired && options?.venueId) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("tier")
        .eq("venue_id", options.venueId)
        .single();

      const tierOrder = ["starter", "pro", "enterprise"];
      const userTierIndex = tierOrder.indexOf(subscription?.tier ?? "starter");
      const requiredTierIndex = tierOrder.indexOf(config.tierRequired);

      if (userTierIndex < requiredTierIndex) {
        enabled = false;
      }
    }

    // Check rollout percentage
    if (config.rolloutPercent !== undefined && config.rolloutPercent < 100) {
      const rolloutSeed = options?.venueId
        ? hashString(options.venueId + feature) % 100
        : Math.random() * 100;
      enabled = rolloutSeed < config.rolloutPercent;
    }
  } catch {
    // Fail open - if we can't check, use default
  }

  featureCache.set(cacheKey, { value: enabled, expires: Date.now() + CACHE_TTL });
  return enabled;
}

/**
 * Enable a feature for a venue (admin only)
 */
export async function enableFor(feature: FeatureFlag, venueId: string): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.from("feature_flag_overrides").upsert(
    {
      feature,
      venue_id: venueId,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "feature,venue_id" }
  );

  invalidateCache(feature, venueId);
}

/**
 * Disable a feature for a venue (admin only)
 */
export async function disableFor(feature: FeatureFlag, venueId: string): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.from("feature_flag_overrides").upsert(
    {
      feature,
      venue_id: venueId,
      enabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "feature,venue_id" }
  );

  invalidateCache(feature, venueId);
}

/**
 * Invalidate cache for a feature
 */
function invalidateCache(feature: FeatureFlag, _venueId?: string): void {
  for (const [key] of featureCache) {
    if (key.startsWith(feature + ":")) {
      featureCache.delete(key);
    }
  }
}

/**
 * Get all features with their status for a venue
 */
export async function getAllFeatures(
  venueId: string
): Promise<Record<FeatureFlag, { enabled: boolean; config: FeatureConfig }>> {
  const supabase = await createServerSupabase();
  const result: Record<FeatureFlag, { enabled: boolean; config: FeatureConfig }> = {} as Record<
    FeatureFlag,
    { enabled: boolean; config: FeatureConfig }
  >;

  // Get venue tier
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("venue_id", venueId)
    .single();

  const tierOrder = ["starter", "pro", "enterprise"];

  for (const [key, config] of Object.entries(FEATURES)) {
    const feature = key as FeatureFlag;
    const enabled = await isEnabled(feature, { venueId });

    result[feature] = {
      enabled,
      config: {
        ...config,
        description:
          config.tierRequired &&
          tierOrder.indexOf(subscription?.tier ?? "starter") <
            tierOrder.indexOf(config.tierRequired)
            ? `${config.description} (${config.tierRequired}+ tier only)`
            : config.description,
      },
    };
  }

  return result;
}

/**
 * Simple string hash for consistent rollout
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Clear all feature caches (useful for testing)
 */
export function clearFeatureCache(): void {
  featureCache.clear();
}

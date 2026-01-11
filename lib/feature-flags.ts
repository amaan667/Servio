/**
 * Feature Flags System
 * Enables gradual rollouts and A/B testing
 */

export interface FeatureFlag {

}

export const FEATURES: Record<string, FeatureFlag> = {
  // Performance features

  },

  },

  },

  // New features (gradual rollout)

  },

  },

  },

  // Experimental features

  },

  },

  },
};

type FeatureName = keyof typeof FEATURES;

/**
 * Check if feature is enabled for a specific venue
 */
export function isFeatureEnabled(feature: FeatureName, venueId?: string): boolean {
  const flag = FEATURES[feature];

  if (!flag) {
    
    return false;
  }

  // Check if globally disabled
  if (!flag.enabled) {
    return false;
  }

  // Check venue-specific overrides
  if (venueId) {
    if (flag.disabledVenues?.includes(venueId)) {
      return false;
    }

    if (flag.enabledVenues?.includes(venueId)) {
      return true;
    }
  }

  // Check rollout percentage
  if (flag.rolloutPercentage === 100) {
    return true;
  }

  if (flag.rolloutPercentage === 0) {
    return false;
  }

  // Deterministic rollout based on venue ID
  if (venueId) {
    const hash = hashString(venueId);
    return hash % 100 < flag.rolloutPercentage;
  }

  // No venue ID - use random rollout
  return Math.random() * 100 < flag.rolloutPercentage;
}

/**
 * Get all enabled features for a venue
 */
export function getEnabledFeatures(venueId?: string): string[] {
  return Object.keys(FEATURES).filter((feature) =>
    isFeatureEnabled(feature as FeatureName, venueId)
  );
}

/**
 * Get feature flag details
 */
export function getFeatureFlag(feature: FeatureName): FeatureFlag | null {
  return FEATURES[feature] || null;
}

/**
 * Get all feature flags (for admin dashboard)
 */
export function getAllFeatureFlags(): Record<string, FeatureFlag> {
  return { ...FEATURES };
}

/**
 * Simple string hash function for deterministic rollouts
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Log feature flag usage (for analytics)
 */
export function logFeatureUsage(feature: FeatureName, venueId?: string, enabled?: boolean) {
  const isEnabled = enabled !== undefined ? enabled : isFeatureEnabled(feature, venueId);

  
}

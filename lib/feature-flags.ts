/**
 * Feature Flags System
 * Enables gradual rollouts and A/B testing
 */

export interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  enabledVenues?: string[]; // Specific venues to enable for
  disabledVenues?: string[]; // Specific venues to disable for
  description?: string;
}

export const FEATURES: Record<string, FeatureFlag> = {
  // Performance features
  parallelAI: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Parallel AI processing for faster menu extraction",
  },
  aiCaching: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Cache AI responses to reduce duplicate API calls",
  },
  menuCaching: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Cache menu data for faster loading",
  },

  // New features (gradual rollout)
  aggressiveImageMatching: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Match URL images at 30-49% similarity threshold",
  },
  dietaryExtraction: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Extract dietary and allergen information from menus",
  },
  categoryDragDrop: {
    enabled: true,
    rolloutPercentage: 100,
    description: "Drag-and-drop category reordering",
  },

  // Experimental features
  mlFeedbackLoop: {
    enabled: false,
    rolloutPercentage: 0,
    description: "Machine learning feedback loop for improving matching",
  },
  offlineMode: {
    enabled: false,
    rolloutPercentage: 0,
    description: "Offline-first menu viewing with service workers",
  },
  advancedAnalytics: {
    enabled: false,
    rolloutPercentage: 10,
    description: "Advanced analytics dashboard with predictive insights",
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

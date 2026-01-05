// Client-safe tier limits and synchronous functions
// This file contains no server-side imports and can be used in client components

export type AnalyticsTier = "basic" | "advanced" | "advanced+exports";
export type KDSTier = "basic" | "advanced" | "enterprise";
export type BrandingTier = "logo+color" | "full+subdomain" | "white-label";
export type SupportLevel = "email" | "priority" | "24/7";

export interface TierLimits {
  maxTables: number;
  maxMenuItems: number;
  maxStaff: number;
  maxVenues: number;
  features: {
    kds: KDSTier | false; // "basic" | "advanced" | "enterprise" | false
    inventory: boolean;
    analytics: AnalyticsTier; // "basic" | "advanced" | "advanced+exports"
    customerFeedback: boolean;
    loyaltyTracking: boolean;
    branding: BrandingTier; // "logo+color" | "full+subdomain" | "white-label"
    apiAccess: boolean;
    aiAssistant: boolean;
    multiVenue: boolean;
    customIntegrations: boolean;
    supportLevel: SupportLevel; // "email" | "priority" | "24/7"
  };
}

// Tier limits based on pricing page: Starter (£99), Pro (£249), Enterprise (£499+)
export const TIER_LIMITS: Record<string, TierLimits> = {
  starter: {
    maxTables: 25, // Up to 25 tables
    maxMenuItems: 50,
    maxStaff: 5, // Up to 5 staff accounts
    maxVenues: 1, // 1 location
    features: {
      kds: false, // KDS not included - available as add-on
      inventory: false, // Not included
      analytics: "basic", // Basic dashboard & daily reports
      customerFeedback: true, // Included
      loyaltyTracking: false, // Not included
      branding: "logo+color", // Logo + colour theme
      apiAccess: false, // Not included
      aiAssistant: false,
      multiVenue: false,
      customIntegrations: false,
      supportLevel: "email", // Email support
    },
  },
  pro: {
    maxTables: 100, // Up to 100 tables
    maxMenuItems: 200,
    maxStaff: 15, // Up to 15 staff accounts
    maxVenues: 3, // Up to 3 locations
    features: {
      kds: "advanced", // Advanced KDS (multi-station)
      inventory: true, // Inventory & stock management
      analytics: "advanced+exports", // Advanced analytics + CSV exports
      customerFeedback: true, // Included
      loyaltyTracking: true, // Loyalty & repeat customer tracking
      branding: "full+subdomain", // Full branding + custom subdomain
      apiAccess: false, // Available as add-on (light API)
      aiAssistant: false, // AI Assistant is Enterprise only (Pro has AI insights in analytics, not full AI Assistant)
      multiVenue: true, // Up to 3 locations
      customIntegrations: false,
      supportLevel: "priority", // Priority email & live chat
    },
  },
  enterprise: {
    maxTables: -1, // Unlimited tables
    maxMenuItems: -1, // Unlimited
    maxStaff: -1, // Unlimited staff accounts
    maxVenues: -1, // Unlimited locations
    features: {
      kds: "enterprise", // Enterprise KDS (multi-venue)
      inventory: true, // Advanced inventory + supplier ordering
      analytics: "advanced+exports", // Enterprise analytics suite & financial exports
      customerFeedback: true, // Included
      loyaltyTracking: true, // Included
      branding: "white-label", // Full white-label + custom domains
      apiAccess: true, // API access, webhooks & POS/accounting integrations
      aiAssistant: true,
      multiVenue: true, // Unlimited locations
      customIntegrations: true,
      supportLevel: "24/7", // 24/7 phone support, SLA & account manager
    },
  },
};

/**
 * Check if tier has access to advanced analytics features (synchronous - for client components)
 * Use this when you already have the tier from auth context
 */
export function hasAdvancedAnalyticsByTier(tier: string): boolean {
  const tierKey = String(tier || "starter").toLowerCase().trim();
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;
  return (
    limits.features.analytics === "advanced" || limits.features.analytics === "advanced+exports"
  );
}

/**
 * Get analytics tier label for display (synchronous - for client components)
 * Returns: "basic" | "advanced" | "enterprise"
 */
export function getAnalyticsTierLabel(tier: string): "basic" | "advanced" | "enterprise" {
  const tierKey = String(tier || "starter").toLowerCase().trim();
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;

  if (tierKey === "enterprise") {
    return "enterprise";
  }
  if (limits.features.analytics === "advanced+exports" || limits.features.analytics === "advanced") {
    return "advanced";
  }
  return "basic";
}

/**
 * Check if tier has access to KDS (synchronous - for client components)
 */
export function hasKDSAccessByTier(tier: string): boolean {
  const tierKey = String(tier || "starter").toLowerCase().trim();
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;
  return limits.features.kds !== false;
}

/**
 * Get KDS tier for a given tier (synchronous - for client components)
 */
export function getKDSTierByTier(tier: string): KDSTier | false {
  const tierKey = String(tier || "starter").toLowerCase().trim();
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;
  return limits.features.kds || false;
}

/**
 * Check if tier has feature access (synchronous - for client components)
 */
export function hasFeatureAccessByTier(
  tier: string,
  feature: keyof TierLimits["features"]
): boolean {
  const tierKey = String(tier || "starter").toLowerCase().trim();
  const limits = TIER_LIMITS[tierKey] || TIER_LIMITS.starter;

  // Special handling for analytics tier
  if (feature === "analytics") {
    return true; // All tiers have analytics, just different levels
  }

  // Special handling for support level
  if (feature === "supportLevel") {
    return true; // All tiers have support, just different levels
  }

  // Special handling for branding tier
  if (feature === "branding") {
    return true; // All tiers have branding, just different levels
  }

  // Boolean features
  const featureValue = limits.features[feature];
  if (typeof featureValue === "boolean") {
    return featureValue;
  }

  // Special handling for KDS tier
  if (feature === "kds") {
    const kdsValue = featureValue as KDSTier | false;
    return kdsValue !== false;
  }

  return false;
}

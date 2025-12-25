// Tier-based feature restrictions
// Based on pricing table: Starter (£99), Pro (£249), Enterprise (£449+)
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

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

export async function getUserTier(userId: string): Promise<string> {
  const supabase = await createClient();

  // Get user's organization and tier
  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_tier, subscription_status")
    .eq("owner_user_id", userId)
    .single();

  // If subscription is not active, downgrade to starter (but require payment for new users)
  if (!org || org.subscription_status !== "active") {
    return "starter";
  }

  const tier = org.subscription_tier || "starter";

  // Use tier directly from database (should match Stripe exactly)
  // Validate it's a valid tier
  const tierLower = tier.toLowerCase().trim();
  if (["starter", "pro", "enterprise"].includes(tierLower)) {
    return tierLower as "starter" | "pro" | "enterprise";
  }

  // If invalid, default to starter

  logger.warn("[TIER RESTRICTIONS] Invalid tier value in database:", tier, "defaulting to starter");
  return "starter";
}

export async function checkFeatureAccess(
  userId: string,
  feature: keyof TierLimits["features"]
): Promise<{ allowed: boolean; currentTier: string; requiredTier?: string }> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];

  // Safety check: if tier doesn't exist in TIER_LIMITS, default to starter
  if (!limits) {
    logger.warn("[TIER RESTRICTIONS] Invalid tier, defaulting to starter:", { tier });
    const defaultLimits = TIER_LIMITS.starter;

    // Special handling for analytics tier
    if (feature === "analytics") {
      return { allowed: true, currentTier: "starter" };
    }

    // Special handling for support level
    if (feature === "supportLevel") {
      return { allowed: true, currentTier: "starter" };
    }

    // Boolean features - check if starter has it
    const featureValue = defaultLimits.features[feature];
    if (typeof featureValue === "boolean" && featureValue) {
      return { allowed: true, currentTier: "starter" };
    }

    return { allowed: false, currentTier: "starter", requiredTier: "pro" };
  }

  // Special handling for analytics tier
  if (feature === "analytics") {
    const currentAnalytics = limits.features.analytics;
    if (currentAnalytics === "advanced+exports") {
      return { allowed: true, currentTier: tier };
    }
    if (currentAnalytics === "advanced") {
      // Pro tier has advanced analytics
      return { allowed: true, currentTier: tier };
    }
    // Starter tier has basic analytics
    return { allowed: true, currentTier: tier };
  }

  // Special handling for support level
  if (feature === "supportLevel") {
    // All tiers have support, just different levels
    return { allowed: true, currentTier: tier };
  }

  // Boolean features
  const featureValue = limits.features[feature];
  if (typeof featureValue === "boolean" && featureValue) {
    return { allowed: true, currentTier: tier };
  }

  // Special handling for KDS tier
  if (feature === "kds") {
    const currentKDS = limits.features.kds;
    if (currentKDS === "enterprise") {
      return { allowed: true, currentTier: tier };
    }
    if (currentKDS === "advanced") {
      return { allowed: true, currentTier: tier };
    }
    if (currentKDS === "basic") {
      return { allowed: true, currentTier: tier };
    }
    return { allowed: false, currentTier: tier, requiredTier: "starter" };
  }

  // Special handling for branding tier
  if (feature === "branding") {
    // All tiers have branding, just different levels
    return { allowed: true, currentTier: tier };
  }

  // Find the minimum tier that has this feature
  let requiredTier = "enterprise";
  if (TIER_LIMITS.pro.features[feature]) {
    const proValue = TIER_LIMITS.pro.features[feature];
    if (typeof proValue === "boolean" && proValue) {
      requiredTier = "pro";
    }
  }

  return { allowed: false, currentTier: tier, requiredTier };
}

/**
 * Check if user has access to advanced analytics features
 */
export async function hasAdvancedAnalytics(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  return (
    limits.features.analytics === "advanced" || limits.features.analytics === "advanced+exports"
  );
}

/**
 * Check if user has access to analytics exports
 * Pro tier has CSV exports, Enterprise has CSV + financial exports
 */
export async function hasAnalyticsExports(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  // Both Pro and Enterprise have exports (Pro = CSV, Enterprise = CSV + financial)
  return limits.features.analytics === "advanced+exports";
}

/**
 * Get KDS tier for user
 */
export async function getKDSTier(userId: string): Promise<KDSTier | false> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  return limits.features.kds || false;
}

/**
 * Check if user has access to KDS (any tier)
 * Starter tier does NOT have KDS (available as add-on)
 * Pro has Advanced KDS, Enterprise has Enterprise KDS
 */
export async function hasBasicKDS(userId: string): Promise<boolean> {
  const kdsTier = await getKDSTier(userId);
  return kdsTier === "advanced" || kdsTier === "enterprise";
}

/**
 * Check if user has access to advanced KDS (multi-station)
 */
export async function hasAdvancedKDS(userId: string): Promise<boolean> {
  const kdsTier = await getKDSTier(userId);
  return kdsTier === "advanced" || kdsTier === "enterprise";
}

/**
 * Check if user has access to enterprise KDS (multi-venue)
 */
export async function hasEnterpriseKDS(userId: string): Promise<boolean> {
  const kdsTier = await getKDSTier(userId);
  return kdsTier === "enterprise";
}

/**
 * Get maximum number of KDS stations allowed for a user
 * Basic KDS (add-on): 1 station
 * Advanced KDS (Pro): Unlimited (per venue)
 * Enterprise KDS: Unlimited (per venue, multi-venue support)
 */
export async function getMaxKDSStations(userId: string): Promise<number> {
  const kdsTier = await getKDSTier(userId);
  if (kdsTier === "basic") {
    return 1; // Basic KDS (add-on) - single station only
  }
  if (kdsTier === "advanced" || kdsTier === "enterprise") {
    return -1; // Unlimited stations per venue
  }
  return 0; // No KDS access
}

/**
 * Check station creation limit based on KDS tier
 */
export async function checkKDSStationLimit(
  userId: string,
  currentStationCount: number
): Promise<{ allowed: boolean; limit: number; currentTier: string; kdsTier: KDSTier | false }> {
  const kdsTier = await getKDSTier(userId);
  const tier = await getUserTier(userId);

  if (!kdsTier) {
    return {
      allowed: false,
      limit: 0,
      currentTier: tier,
      kdsTier: false,
    };
  }

  const maxStations = await getMaxKDSStations(userId);

  if (maxStations === -1) {
    return {
      allowed: true,
      limit: -1,
      currentTier: tier,
      kdsTier,
    };
  }

  return {
    allowed: currentStationCount < maxStations,
    limit: maxStations,
    currentTier: tier,
    kdsTier,
  };
}

/**
 * Check if user has access to loyalty tracking
 */
export async function hasLoyaltyTracking(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  return limits.features.loyaltyTracking === true;
}

/**
 * Get branding tier for user
 */
export async function getBrandingTier(userId: string): Promise<BrandingTier> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  return limits.features.branding;
}

export async function checkLimit(
  userId: string,
  limitType: "maxTables" | "maxMenuItems" | "maxStaff" | "maxVenues",
  currentCount: number
): Promise<{ allowed: boolean; limit: number; currentTier: string }> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];

  // Safety check: if tier doesn't exist, default to starter
  if (!limits) {
    logger.warn("[TIER RESTRICTIONS] Invalid tier, defaulting to starter:", { tier });
    const defaultLimits = TIER_LIMITS.starter;
    const limit = defaultLimits[limitType];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit, currentTier: "starter" };
    }

    return {
      allowed: currentCount < limit,
      limit,
      currentTier: "starter",
    };
  }

  const limit = limits[limitType];

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit, currentTier: tier };
  }

  return {
    allowed: currentCount < limit,
    limit,
    currentTier: tier,
  };
}

// Middleware helper for API routes
export async function requireFeature(
  userId: string,
  feature: keyof TierLimits["features"]
): Promise<void> {
  const access = await checkFeatureAccess(userId, feature);

  if (!access.allowed) {
    throw new Error(
      `This feature requires ${access.requiredTier} tier. Current tier: ${access.currentTier}`
    );
  }
}

// Get tier limits for a user
export async function getTierLimits(userId: string): Promise<TierLimits> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
  return limits || TIER_LIMITS.starter;
}

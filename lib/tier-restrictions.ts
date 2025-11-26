// Tier-based feature restrictions
// Based on pricing table: Starter (£99), Pro (£249), Enterprise (£449+)
import { createClient } from "@/lib/supabase";

export type AnalyticsTier = "basic" | "advanced" | "advanced+exports";
export type SupportLevel = "email" | "priority" | "24/7";

export interface TierLimits {
  maxTables: number;
  maxMenuItems: number;
  maxStaff: number;
  maxVenues: number;
  features: {
    kds: boolean;
    inventory: boolean;
    analytics: AnalyticsTier; // "basic" | "advanced" | "advanced+exports"
    customerFeedback: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    aiAssistant: boolean;
    multiVenue: boolean;
    customIntegrations: boolean;
    supportLevel: SupportLevel; // "email" | "priority" | "24/7"
  };
}

// Tier limits based on homepage pricing table
export const TIER_LIMITS: Record<string, TierLimits> = {
  starter: {
    maxTables: 20,
    maxMenuItems: 50,
    maxStaff: 3,
    maxVenues: 1,
    features: {
      kds: false,
      inventory: false,
      analytics: "basic", // Basic dashboard only
      customerFeedback: false,
      customBranding: false,
      apiAccess: false,
      aiAssistant: false,
      multiVenue: false,
      customIntegrations: false,
      supportLevel: "email", // Email support
    },
  },
  pro: {
    maxTables: 50,
    maxMenuItems: 200,
    maxStaff: 10,
    maxVenues: 1,
    features: {
      kds: false,
      inventory: true,
      analytics: "advanced", // Advanced & AI insights (PredictiveInsights component)
      customerFeedback: true,
      customBranding: false,
      apiAccess: false,
      aiAssistant: false, // AI Assistant chat is Enterprise only
      multiVenue: false,
      customIntegrations: false,
      supportLevel: "priority", // Priority email support
    },
  },
  enterprise: {
    maxTables: -1, // Unlimited
    maxMenuItems: -1, // Unlimited
    maxStaff: -1, // Unlimited
    maxVenues: -1, // Unlimited
    features: {
      kds: true,
      inventory: true,
      analytics: "advanced+exports", // Advanced + exports
      customerFeedback: true,
      customBranding: true,
      apiAccess: true,
      aiAssistant: true,
      multiVenue: true,
      customIntegrations: true,
      supportLevel: "24/7", // 24/7 priority support
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

  return org.subscription_tier || "starter";
}

export async function checkFeatureAccess(
  userId: string,
  feature: keyof TierLimits["features"]
): Promise<{ allowed: boolean; currentTier: string; requiredTier?: string }> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];

  // Safety check: if tier doesn't exist in TIER_LIMITS, default to starter
  if (!limits) {
    // eslint-disable-next-line no-console
    console.error("[TIER RESTRICTIONS] Invalid tier:", tier, "defaulting to starter");
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
 */
export async function hasAnalyticsExports(userId: string): Promise<boolean> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  return limits.features.analytics === "advanced+exports";
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
    // eslint-disable-next-line no-console
    console.error("[TIER RESTRICTIONS] Invalid tier:", tier, "defaulting to starter");
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

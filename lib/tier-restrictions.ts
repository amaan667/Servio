// Tier-based feature restrictions
import { createClient } from "@/lib/supabase";

export interface TierLimits {
  maxTables: number;
  maxMenuItems: number;
  maxStaff: number;
  maxVenues: number;
  features: {
    kds: boolean;
    inventory: boolean;
    analytics: boolean;
    aiAssistant: boolean;
    multiVenue: boolean;
    customIntegrations: boolean;
    prioritySupport: boolean;
  };
}

// Tier limits based on homepage pricing
export const TIER_LIMITS: Record<string, TierLimits> = {
  starter: {
    maxTables: 10,
    maxMenuItems: 50,
    maxStaff: 3,
    maxVenues: 1,
    features: {
      kds: false,
      inventory: false,
      analytics: true,
      aiAssistant: false,
      multiVenue: false,
      customIntegrations: false,
      prioritySupport: false,
    },
  },
  pro: {
    maxTables: 20,
    maxMenuItems: 200,
    maxStaff: 10,
    maxVenues: 1,
    features: {
      kds: true,
      inventory: true,
      analytics: true,
      aiAssistant: false,
      multiVenue: false,
      customIntegrations: false,
      prioritySupport: true,
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
      analytics: true,
      aiAssistant: true,
      multiVenue: true,
      customIntegrations: true,
      prioritySupport: true,
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

  if (limits.features[feature]) {
    return { allowed: true, currentTier: tier };
  }

  // Find the minimum tier that has this feature
  let requiredTier = "enterprise";
  if (TIER_LIMITS.pro.features[feature]) {
    requiredTier = "pro";
  }

  return { allowed: false, currentTier: tier, requiredTier };
}

export async function checkLimit(
  userId: string,
  limitType: "maxTables" | "maxMenuItems" | "maxStaff" | "maxVenues",
  currentCount: number
): Promise<{ allowed: boolean; limit: number; currentTier: string }> {
  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
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

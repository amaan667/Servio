// Client-safe tier limits and synchronous functions
// This file contains no server-side imports and can be used in client components

import type { UserRole } from "@/lib/permissions";

export type AnalyticsTier = "basic" | "advanced" | "advanced+exports";
export type KDSTier = "basic" | "advanced" | "enterprise";
export type BrandingTier = "logo+color" | "full+subdomain" | "white-label";
export type SupportLevel = "email" | "priority" | "24/7";

export interface TierLimits {

  };
}

// Tier limits based on pricing page: Starter (£99), Pro (£249), Enterprise (£499+)
export const TIER_LIMITS: Record<string, TierLimits> = {

    maxTables: 25, // Up to 25 tables

    maxStaff: 5, // Up to 5 staff accounts
    maxVenues: 1, // 1 location

      kds: false, // KDS not included - available as add-on
      inventory: false, // Not included
      analytics: "basic", // Basic dashboard & daily reports
      customerFeedback: true, // Included
      loyaltyTracking: false, // Not included
      branding: "logo+color", // Logo + colour theme
      apiAccess: false, // Not included

      supportLevel: "email", // Email support
    },
  },

    maxTables: 100, // Up to 100 tables

    maxStaff: 15, // Up to 15 staff accounts
    maxVenues: 3, // Up to 3 locations

      kds: "advanced", // Advanced KDS (multi-station)
      inventory: true, // Inventory & stock management
      analytics: "advanced+exports", // Advanced analytics + CSV exports
      customerFeedback: true, // Included
      loyaltyTracking: true, // Loyalty & repeat customer tracking
      branding: "full+subdomain", // Full branding + custom subdomain
      apiAccess: false, // Available as add-on (light API)
      aiAssistant: false, // AI Assistant is Enterprise only (Pro has AI insights in analytics, not full AI Assistant)
      multiVenue: true, // Up to 3 locations

      supportLevel: "priority", // Priority email & live chat
    },
  },

    maxTables: -1, // Unlimited tables
    maxMenuItems: -1, // Unlimited
    maxStaff: -1, // Unlimited staff accounts
    maxVenues: -1, // Unlimited locations

      kds: "enterprise", // Enterprise KDS (multi-venue)
      inventory: true, // Advanced inventory + supplier ordering
      analytics: "advanced+exports", // Enterprise analytics suite & financial exports
      customerFeedback: true, // Included
      loyaltyTracking: true, // Included
      branding: "white-label", // Full white-label + custom domains
      apiAccess: true, // API access, webhooks & POS/accounting integrations

      multiVenue: true, // Unlimited locations

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
// Client-safe types and functions
export type Tier = "starter" | "pro" | "enterprise";
export type FeatureKey =
  | "kds"
  | "inventory"
  | "analytics"
  | "customerFeedback"
  | "loyaltyTracking"
  | "branding"
  | "customBranding"
  | "apiAccess"
  | "aiAssistant"
  | "multiVenue"
  | "customIntegrations";

export interface AccessContext {

  permissions: Record<string, unknown>;
}

export function hasFeatureAccess(

  // For KDS tier, return true if not false
  if (feature === "kds" || featureKey === "kds") {
    return featureValue !== false;
  }

  // For boolean features, return the value directly
  if (typeof featureValue === "boolean") {
    return featureValue;
  }

  return true;
}

export function hasFeatureAccessByTier(

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

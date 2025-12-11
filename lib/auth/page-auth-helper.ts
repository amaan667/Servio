/**
 * Reusable Page Authentication Helper
 *
 * Use this in all dashboard page.tsx files for consistent auth checking
 *
 * CRITICAL: NO REDIRECTS - User requested ZERO sign-in redirects
 * Returns null on auth failures instead of redirecting
 */

// redirect import removed - NO REDIRECTS
import { createServerSupabase } from "@/lib/supabase";
import { verifyVenueAccess } from "@/lib/middleware/authorization";
import { getUserTier, TIER_LIMITS } from "@/lib/tier-restrictions";
import type { User } from "@supabase/supabase-js";

export type UserRole = "owner" | "manager" | "server" | "staff" | "viewer";

export type Tier = "starter" | "pro" | "enterprise";

export type FeatureKey =
  | "kds"
  | "inventory"
  | "analytics"
  | "customerFeedback"
  | "customBranding"
  | "apiAccess"
  | "aiAssistant"
  | "multiVenue"
  | "customIntegrations";

export interface PageAuthContext {
  user: { id: string; email?: string | null };
  venueId: string;
  role: UserRole;
  tier: Tier;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
}

export interface RequirePageAuthOptions {
  requireFeature?: FeatureKey;
  requireRole?: UserRole[];
  allowNoVenue?: boolean; // e.g. /dashboard (no [venueId])
}

/**
 * Main helper used by ALL dashboard pages
 *
 * NEVER throws - always redirects on auth failures to prevent 500 errors
 *
 * Usage:
 * ```typescript
 * export default async function MyPage({ params }: { params: { venueId: string } }) {
 *   const { venueId } = params;
 *
 *   const auth = await requirePageAuth(venueId, {
 *     requireFeature: "aiAssistant", // optional
 *     requireRole: ["owner", "manager"], // optional
 *   });
 *
 *   // Now safe to fetch data and render
 *   return <MyClientPage venueId={venueId} tier={auth.tier} role={auth.role} />;
 * }
 * ```
 */
export async function requirePageAuth(
  venueIdFromPage?: string,
  options: RequirePageAuthOptions = {}
): Promise<PageAuthContext | null> {
  // STEP 1: Get user from Supabase session (cookie-aware)
  // Use createServerSupabase directly for better cookie handling in production
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    // NO REDIRECTS - User requested ZERO sign-in redirects
    // Return null instead of redirecting - let client handle auth
    return null;
  }

  // STEP 2: Resolve venueId
  let venueId = venueIdFromPage;

  if (!venueId && !options.allowNoVenue) {
    // NO REDIRECTS - User requested ZERO sign-in redirects
    // Return null instead of redirecting
    return null;
  }

  // Pages like /dashboard (no venue) can skip membership check
  if (!venueId) {
    // Return minimal context for pages without venue
    const tier = await getUserTier(user.id);
    return {
      user: { id: user.id, email: user.email },
      venueId: "", // Empty for no-venue pages
      role: "owner" as UserRole, // Default
      tier: tier as Tier,
      hasFeatureAccess: () => false, // No features without venue
    };
  }

  // STEP 3: Verify venue access (uses existing verifyVenueAccess function)
  const access = await verifyVenueAccess(venueId, user.id);

  if (!access) {
    // NO REDIRECTS - User requested ZERO sign-in redirects
    // Return null instead of redirecting - but user IS authenticated
    return null;
  }

  const role = access.role as UserRole;

  // STEP 4: Get user tier
  const tier = (await getUserTier(user.id)) as Tier;

  // STEP 5: Role check (if specified)
  if (options.requireRole && !options.requireRole.includes(role)) {
    // NO REDIRECTS - User requested ZERO sign-in redirects
    // Return null instead of redirecting
    return null;
  }

  // STEP 6: Feature check (if specified)
  if (options.requireFeature) {
    const tierLimits = TIER_LIMITS[tier];
    if (!tierLimits) {
      // NO REDIRECTS - User requested ZERO sign-in redirects
      // Return null instead of redirecting
      return null;
    }

    const featureValue = tierLimits.features[options.requireFeature];

    // For boolean features, check the value directly
    if (typeof featureValue === "boolean" && !featureValue) {
      // NO REDIRECTS - User requested ZERO sign-in redirects
      // Return null instead of redirecting
      return null;
    }

    // For analytics and supportLevel, they're always allowed (just different levels)
    // So we don't redirect for those
  }

  // STEP 7: Create feature access helper
  const hasFeatureAccess = (feature: FeatureKey): boolean => {
    const tierLimits = TIER_LIMITS[tier];
    if (!tierLimits) return false;

    const featureValue = tierLimits.features[feature];
    // For boolean features, return the value directly
    if (typeof featureValue === "boolean") {
      return featureValue;
    }
    // For analytics and supportLevel, they're always allowed (just different levels)
    return true;
  };

  // STEP 8: All good → return context to the page
  return {
    user: { id: user.id, email: user.email },
    venueId,
    role,
    tier,
    hasFeatureAccess,
  };
}

/**
 * Optional page auth - returns null if not authenticated instead of redirecting
 * Useful for pages that can be viewed by unauthenticated users
 */
export async function getOptionalPageAuth(venueId?: string): Promise<PageAuthContext | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    if (!venueId) {
      const tier = await getUserTier(user.id);
      return {
        user: { id: user.id, email: user.email },
        venueId: "",
        role: "owner" as UserRole,
        tier: tier as Tier,
        hasFeatureAccess: () => false,
      };
    }

    const access = await verifyVenueAccess(venueId, user.id);
    if (!access) {
      return null;
    }

    const tier = (await getUserTier(user.id)) as Tier;
    const tierLimits = TIER_LIMITS[tier] || TIER_LIMITS.starter;

    const hasFeatureAccess = (feature: FeatureKey): boolean => {
      const featureValue = tierLimits.features[feature];
      if (typeof featureValue === "boolean") {
        return featureValue;
      }
      return true;
    };

    return {
      user: { id: user.id, email: user.email },
      venueId,
      role: access.role as UserRole,
      tier,
      hasFeatureAccess,
    };
  } catch {
    return null;
  }
}

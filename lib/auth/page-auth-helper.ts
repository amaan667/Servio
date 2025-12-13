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
import { cache } from "react";

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
const getBasePageAuth = cache(
  async (venueIdFromPage?: string, allowNoVenue = false): Promise<PageAuthContext | null> => {
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
    const venueId = venueIdFromPage;

    if (!venueId && !allowNoVenue) {
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

    // STEP 4: Get subscription tier
    // IMPORTANT: Tier is owned by the venue's billing owner/org, not the staff user.
    // This prevents staff accounts incorrectly defaulting to Starter.
    const tier = (await getUserTier(access.venue.owner_user_id)) as Tier;

    // STEP 5: Create feature access helper
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

    // All good → return base context
    return {
      user: { id: user.id, email: user.email },
      venueId,
      role,
      tier,
      hasFeatureAccess,
    };
  }
);

export async function requirePageAuth(
  venueIdFromPage?: string,
  options: RequirePageAuthOptions = {}
): Promise<PageAuthContext | null> {
  const base = await getBasePageAuth(venueIdFromPage, options.allowNoVenue ?? false);
  if (!base) return null;

  // Role check (if specified) - this IS an authorization boundary (pages may fetch admin data).
  if (options.requireRole && !options.requireRole.includes(base.role)) {
    // NO REDIRECTS - User requested ZERO sign-in redirects
    // Return null instead of redirecting
    return null;
  }

  // Feature checks should NOT null the context.
  // Pages can still render an upsell/denied state while showing the correct tier.
  return base;
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

    // IMPORTANT: Tier is owned by the venue's billing owner/org, not the staff user.
    const tier = (await getUserTier(access.venue.owner_user_id)) as Tier;
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

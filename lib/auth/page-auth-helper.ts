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
import { TIER_LIMITS } from "@/lib/tier-restrictions";
import { logger } from "@/lib/logger";
import { cache } from "react";
import { getAccessContext } from "@/lib/access/getAccessContext";
import type { UserRole } from "@/lib/permissions";

export type { UserRole };

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
    // STEP 1: Resolve venueId
    const venueId = venueIdFromPage;

    if (!venueId && !allowNoVenue) {
      // NO REDIRECTS - User requested ZERO sign-in redirects
      // Return null instead of redirecting
      return null;
    }

    // STEP 2: Get unified access context via RPC (single database call)
    const accessContext = await getAccessContext(venueId || null);

    if (!accessContext) {
      // CRITICAL: If user is properly authenticated, this should never happen
      // Log detailed error information to diagnose auth issues
      logger.error("[PAGE AUTH] CRITICAL: Access context failed - this should never happen for authenticated users", {
        venueId: venueId || "none",
        timestamp: new Date().toISOString(),
      });

      // Try to get user info directly to diagnose the issue
      try {
        const { user, error: authError } = await getAuthenticatedUser();
        logger.error("[PAGE AUTH] Auth diagnostics", {
          hasUser: !!user,
          userId: user?.id,
          authError: authError,
          venueId: venueId || "none",
        });
      } catch (diagError) {
        logger.error("[PAGE AUTH] Auth diagnostics failed", {
          error: diagError instanceof Error ? diagError.message : String(diagError),
          venueId: venueId || "none",
        });
      }

      // Still return null to prevent crashes, but this indicates a serious auth issue
      return null;
    }

    // STEP 3: Create feature access helper
    const hasFeatureAccess = (feature: FeatureKey): boolean => {
      const tierLimits = TIER_LIMITS[accessContext.tier];
      if (!tierLimits) {
        logger.warn("[PAGE AUTH] Invalid tier limits", {
          tier: accessContext.tier,
          feature,
          venueId,
        });
        return false;
      }

      // Handle legacy "customBranding" -> "branding" mapping
      const featureKey = feature === "customBranding" ? "branding" : feature;
      const featureValue = tierLimits.features[featureKey as keyof typeof tierLimits.features];
      
      // For KDS tier (basic/advanced/enterprise), return true if not false (check before boolean check)
      if (feature === "kds" || featureKey === "kds") {
        const hasAccess = featureValue !== false;
        logger.info("[PAGE AUTH] KDS access check", {
          tier: accessContext.tier,
          featureValue,
          hasAccess,
          venueId,
        });
        return hasAccess;
      }
      // For boolean features, return the value directly
      if (typeof featureValue === "boolean") {
        return featureValue;
      }
      // For analytics and supportLevel, they're always allowed (just different levels)
      return true;
    };

    // Get user email if available
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // All good → return base context
    return {
      user: { id: accessContext.user_id, email: user?.email || null },
      venueId: accessContext.venue_id || "",
      role: accessContext.role,
      tier: accessContext.tier,
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
    // Use unified access context via RPC
    const accessContext = await getAccessContext(venueId || null);

    if (!accessContext) {
      return null;
    }

    const tierLimits = TIER_LIMITS[accessContext.tier] || TIER_LIMITS.starter;

    const hasFeatureAccess = (feature: FeatureKey): boolean => {
      // Handle legacy "customBranding" -> "branding" mapping
      const featureKey = feature === "customBranding" ? "branding" : feature;
      const featureValue = tierLimits.features[featureKey as keyof typeof tierLimits.features];
      // For KDS tier (basic/advanced/enterprise), return true if not false (check before boolean check)
      if (feature === "kds" || featureKey === "kds") {
        return featureValue !== false;
      }
      // For boolean features, return the value directly
      if (typeof featureValue === "boolean") {
        return featureValue;
      }
      return true;
    };

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      user: { id: accessContext.user_id, email: user?.email || null },
      venueId: accessContext.venue_id || "",
      role: accessContext.role,
      tier: accessContext.tier,
      hasFeatureAccess,
    };
  } catch {
    return null;
  }
}

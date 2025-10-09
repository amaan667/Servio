/**
 * Feature Gating System
 * 
 * Controls access to premium features based on venue subscription tier.
 * 
 * Subscription Tiers:
 * - basic: Up to 10 tables, QR ordering
 * - standard: Up to 20 tables, Full analytics
 * - premium: Unlimited tables/venues, KDS, Inventory, Staff management
 */

import { createClient } from '@/lib/supabase/server';

export type SubscriptionTier = 'basic' | 'standard' | 'premium';

export interface FeatureAccess {
  hasAccess: boolean;
  tier: SubscriptionTier;
  requiredTier?: SubscriptionTier;
  message?: string;
}

// Premium features that require subscription
export const PREMIUM_FEATURES = {
  INVENTORY: 'premium' as SubscriptionTier,
  KDS: 'premium' as SubscriptionTier,
  STAFF_MANAGEMENT: 'premium' as SubscriptionTier,
  ADVANCED_ANALYTICS: 'standard' as SubscriptionTier,
  MULTIPLE_VENUES: 'premium' as SubscriptionTier,
} as const;

/**
 * Check if a venue has access to a specific feature
 */
export async function checkFeatureAccess(
  venueId: string,
  requiredTier: SubscriptionTier
): Promise<FeatureAccess> {
  try {
    const supabase = await createClient();

    // Get venue subscription info
    // For now, we'll check if a subscription_tier column exists on venues table
    // This can be enhanced to check Stripe subscriptions
    const { data: venue, error } = await supabase
      .from('venues')
      .select('subscription_tier')
      .eq('venue_id', venueId)
      .single();

    if (error) {
      console.error('[FEATURE GATE] Error fetching venue:', error);
      // Default to basic tier if error
      return {
        hasAccess: requiredTier === 'basic',
        tier: 'basic',
        requiredTier,
        message: 'Unable to verify subscription',
      };
    }

    // If no subscription_tier column exists, default to allowing all features for now
    // This maintains backward compatibility
    const currentTier = (venue?.subscription_tier as SubscriptionTier) || 'premium';

    const tierHierarchy: Record<SubscriptionTier, number> = {
      basic: 1,
      standard: 2,
      premium: 3,
    };

    const hasAccess = tierHierarchy[currentTier] >= tierHierarchy[requiredTier];

    return {
      hasAccess,
      tier: currentTier,
      requiredTier,
      message: hasAccess
        ? undefined
        : `This feature requires ${requiredTier} tier. Your current tier is ${currentTier}.`,
    };
  } catch (error) {
    console.error('[FEATURE GATE] Unexpected error:', error);
    return {
      hasAccess: false,
      tier: 'basic',
      requiredTier,
      message: 'An error occurred while checking feature access',
    };
  }
}

/**
 * Middleware to check feature access and return 403 if not allowed
 */
export async function requireFeatureAccess(
  venueId: string,
  requiredTier: SubscriptionTier
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const access = await checkFeatureAccess(venueId, requiredTier);

  if (!access.hasAccess) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Feature not available',
          message: access.message,
          currentTier: access.tier,
          requiredTier: access.requiredTier,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Client-side hook to check feature access
 * This should be used in combination with server-side checks
 */
export async function clientCheckFeatureAccess(
  venueId: string,
  feature: keyof typeof PREMIUM_FEATURES
): Promise<FeatureAccess> {
  try {
    const response = await fetch(`/api/features/check?venue_id=${venueId}&feature=${feature}`);
    return await response.json();
  } catch (error) {
    console.error('[FEATURE GATE CLIENT] Error:', error);
    return {
      hasAccess: false,
      tier: 'basic',
      message: 'Unable to check feature access',
    };
  }
}


// Middleware helpers for enforcing tier limits in API routes
import { createClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { checkLimit, checkFeatureAccess } from "./tier-restrictions";

interface TierCheckResult {
  allowed: boolean;
  response?: NextResponse;
  tier?: string;
}

/**
 * Check if user can create more of a resource type
 * Returns error response if limit exceeded
 */
export async function enforceResourceLimit(
  userId: string,
  venueId: string,
  resourceType: "maxMenuItems" | "maxTables" | "maxStaff" | "maxVenues",
  currentCount: number
): Promise<TierCheckResult> {
  const supabase = await createClient();

  // Check if grandfathered
  const { data: venue } = await supabase
    .from("venues")
    .select("organizations(is_grandfathered)")
    .eq("venue_id", venueId)
    .single();

  // Handle organizations as single object (foreign key relation)
  const organization = venue?.organizations && (Array.isArray(venue.organizations) ? venue.organizations[0] : venue.organizations);

  if (organization?.is_grandfathered) {
    return { allowed: true, tier: "grandfathered" };
  }

  // Check limit
  const { allowed, limit, currentTier } = await checkLimit(
    userId,
    resourceType,
    currentCount
  );

  if (!allowed) {
    const resourceName = resourceType.replace("max", "").toLowerCase();
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `Limit reached: ${currentCount}/${limit} ${resourceName}`,
          currentTier,
          limit,
          upgradeRequired: true,
          message: `Upgrade your plan to add more ${resourceName}`,
        },
        { status: 403 }
      ),
      tier: currentTier,
    };
  }

  return { allowed: true, tier: currentTier };
}

/**
 * Check if user can access a feature
 * Returns error response if feature not available in tier
 */
export async function enforceFeatureAccess(
  userId: string,
  venueId: string,
  feature: "kds" | "inventory" | "analytics" | "aiAssistant" | "multiVenue"
): Promise<TierCheckResult> {
  const supabase = await createClient();

  // Check if grandfathered
  const { data: venue } = await supabase
    .from("venues")
    .select("organizations(is_grandfathered)")
    .eq("venue_id", venueId)
    .single();

  // Handle organizations as single object (foreign key relation)
  const organization = venue?.organizations && (Array.isArray(venue.organizations) ? venue.organizations[0] : venue.organizations);

  if (organization?.is_grandfathered) {
    return { allowed: true, tier: "grandfathered" };
  }

  // Check feature access
  const { allowed, currentTier, requiredTier } = await checkFeatureAccess(
    userId,
    feature
  );

  if (!allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `This feature requires ${requiredTier} tier`,
          currentTier,
          requiredTier,
          upgradeRequired: true,
          message: `Upgrade to ${requiredTier} to access ${feature}`,
        },
        { status: 403 }
      ),
      tier: currentTier,
    };
  }

  return { allowed: true, tier: currentTier };
}

/**
 * Helper to get organization for a venue
 */
export async function getVenueOrganization(venueId: string) {
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("organization_id, organizations(*)")
    .eq("venue_id", venueId)
    .single();

  // Handle organizations as single object (foreign key relation)
  const organization = venue?.organizations && (Array.isArray(venue.organizations) ? venue.organizations[0] : venue.organizations);

  return organization || null;
}


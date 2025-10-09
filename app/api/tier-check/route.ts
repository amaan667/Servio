// Tier Check API - Check if user can perform an action
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkLimit, checkFeatureAccess, getTierLimits } from "@/lib/tier-restrictions";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, resource, currentCount, venueId } = body;

    // Get organization
    const { data: venue } = await supabase
      .from("venues")
      .select("organization_id, organizations(subscription_tier, is_grandfathered)")
      .eq("venue_id", venueId)
      .single();

    if (!venue?.organizations) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Grandfathered accounts always allowed
    if (venue.organizations.is_grandfathered) {
      return NextResponse.json({
        allowed: true,
        tier: "grandfathered",
        reason: "Grandfathered account - unlimited access",
      });
    }

    // Check based on action type
    if (action === "create" && resource) {
      const limitCheck = await checkLimit(user.id, resource, currentCount);
      
      if (!limitCheck.allowed) {
        return NextResponse.json({
          allowed: false,
          tier: limitCheck.currentTier,
          limit: limitCheck.limit,
          current: currentCount,
          reason: `Limit reached: ${currentCount}/${limitCheck.limit} ${resource.replace("max", "").toLowerCase()}`,
          upgradeRequired: true,
        });
      }

      return NextResponse.json({
        allowed: true,
        tier: limitCheck.currentTier,
        limit: limitCheck.limit,
        current: currentCount,
      });
    }

    // Check feature access
    if (action === "access" && resource) {
      const featureCheck = await checkFeatureAccess(user.id, resource);
      
      if (!featureCheck.allowed) {
        return NextResponse.json({
          allowed: false,
          tier: featureCheck.currentTier,
          requiredTier: featureCheck.requiredTier,
          reason: `This feature requires ${featureCheck.requiredTier} tier`,
          upgradeRequired: true,
        });
      }

      return NextResponse.json({
        allowed: true,
        tier: featureCheck.currentTier,
      });
    }

    // Get all limits
    const limits = await getTierLimits(user.id);

    return NextResponse.json({
      allowed: true,
      limits,
      tier: venue.organizations.subscription_tier,
    });
  } catch (error: any) {
    console.error("[TIER CHECK] Error:", error);
    return NextResponse.json(
      { error: error.message || "Tier check failed" },
      { status: 500 }
    );
  }
}


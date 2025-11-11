// Tier Check API - Check if user can perform an action
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkLimit, checkFeatureAccess, getTierLimits } from "@/lib/tier-restrictions";
import { logger } from "@/lib/logger";

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await _request.json();
    const { action, resource, currentCount, venueId } = body;

    // Get venue to verify access
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_id, owner_user_id")
      .eq("venue_id", venueId)
      .single();

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
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

    // Get all limits and current tier
    const limits = await getTierLimits(user.id);

    // Get user's organization to return tier info
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      allowed: true,
      limits,
      tier: org?.subscription_tier || "starter",
    });
  } catch (_error) {
    logger.error("[TIER CHECK] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Tier check failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Admin endpoint to update subscription tier
 * POST /api/admin/update-tier
 * Body: { email: string, tier: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, tier } = await request.json();

    if (!email || !tier) {
      return NextResponse.json({ error: "Email and tier are required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[ADMIN UPDATE TIER] Request to update tier", {
      email,
      tier,
      requestedBy: user.email,
    });

    // Only allow user to update their own tier (or add admin check here)
    if (user.email !== email) {
      return NextResponse.json({ error: "Can only update your own subscription" }, { status: 403 });
    }

    // Find organization for this user
    const { data: venues } = await supabase
      .from("venues")
      .select("organization_id")
      .eq("owner_user_id", user.id)
      .limit(1);

    if (!venues || venues.length === 0) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const organizationId = venues[0].organization_id;

    // Get current org data
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    logger.info("[ADMIN UPDATE TIER] Current subscription", {
      orgId: organizationId,
      currentTier: org.subscription_tier,
      currentStatus: org.subscription_status,
    });

    // Update subscription tier
    const { error } = await supabase
      .from("organizations")
      .update({
        subscription_tier: tier,
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (error) {
      logger.error("[ADMIN UPDATE TIER] Update failed", { error });
      return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
    }

    logger.info("[ADMIN UPDATE TIER] Successfully updated tier", {
      orgId: organizationId,
      newTier: tier,
    });

    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${tier}`,
      organization: {
        id: organizationId,
        tier,
        status: "active",
      },
    });
  } catch (err) {
    logger.error("[ADMIN UPDATE TIER] Unexpected error", { error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

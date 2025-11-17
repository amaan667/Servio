import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Simple endpoint to set current user to enterprise tier
 * POST /api/admin/set-premium
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[SET PREMIUM] Setting user to enterprise tier", {
      userId: user.id,
      email: user.email,
    });

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

    logger.info("[SET PREMIUM] Current organization state", {
      orgId: organizationId,
      currentTier: org.subscription_tier,
      currentStatus: org.subscription_status,
      hasStripeCustomer: !!org.stripe_customer_id,
    });

    // Update to enterprise
    const { error } = await supabase
      .from("organizations")
      .update({
        subscription_tier: "enterprise",
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (error) {
      logger.error("[SET PREMIUM] Update failed", { error });
      return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
    }

    logger.info("[SET PREMIUM] ✅ Successfully set to enterprise", {
      orgId: organizationId,
    });

    // Also return cache clearing instruction
    const response = NextResponse.json({
      success: true,
      message: "Subscription updated to enterprise",
      before: {
        tier: org.subscription_tier,
        status: org.subscription_status,
      },
      after: {
        tier: "enterprise",
        status: "active",
      },
      clearCache: true, // Signal to client to clear cache
    });

    return response;
  } catch (err) {
    logger.error("[SET PREMIUM] Unexpected error", { error: err });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

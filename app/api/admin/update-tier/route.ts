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
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Admin role check
    const { data: userRole } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin" && userRole?.role !== "owner") {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    logger.info("[ADMIN UPDATE TIER] Request to update tier", {
      email,
      tier,
      requestedBy: user.email,
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

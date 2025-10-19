// API endpoint to manually update organization plan (backup for webhook)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiLogger, logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { tier } = await request.json();
    
    if (!tier) {
      return NextResponse.json(
        { error: "Tier is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    logger.debug("[UPDATE PLAN] Updating plan for user:", user.id, "to tier:", tier);

    // Find the user's organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, subscription_tier, subscription_status")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (orgError) {
      logger.error("[UPDATE PLAN] Error finding organization:", orgError);
      return NextResponse.json(
        { error: "Failed to find organization", details: orgError.message },
        { status: 500 }
      );
    }

    if (!organization) {
      logger.error("[UPDATE PLAN] No organization found for user:", user.id);
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 }
      );
    }

    logger.debug("[UPDATE PLAN] Found organization:", {
      id: organization.id,
      current_tier: organization.subscription_tier,
      current_status: organization.subscription_status
    });

    // Update the organization with new tier
    const updateData = {
      subscription_tier: tier,
      subscription_status: "trialing", // Set to trialing for new subscriptions
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      updated_at: new Date().toISOString(),
    };

    const { data: updatedOrg, error: updateError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", organization.id)
      .select()
      .single();

    if (updateError) {
      logger.error("[UPDATE PLAN] Error updating organization:", updateError);
      return NextResponse.json(
        { error: "Failed to update organization", details: updateError.message },
        { status: 500 }
      );
    }

    logger.debug("[UPDATE PLAN] Successfully updated organization:", {
      id: organization.id,
      new_tier: updatedOrg.subscription_tier,
      new_status: updatedOrg.subscription_status
    });

    // Log the update in subscription history
    try {
      await supabase.from("subscription_history").insert({
        organization_id: organization.id,
        event_type: "manual_update",
        old_tier: organization.subscription_tier,
        new_tier: tier,
        metadata: { source: "checkout_success_backup", user_id: user.id },
      });
      logger.debug("[UPDATE PLAN] Logged subscription history");
    } catch (historyError) {
      logger.warn("[UPDATE PLAN] Failed to log subscription history (non-critical):", historyError);
    }

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
      message: `Plan updated to ${tier} successfully`
    });

  } catch (error: any) {
    logger.error("[UPDATE PLAN] Unexpected error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
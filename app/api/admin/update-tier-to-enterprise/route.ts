// Admin endpoint to update old tier names to new ones
// Updates "premium" → "enterprise", "standard" → "pro", "basic" → "starter"
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Update all organizations with old tier names
    const { data: premiumOrgs, error: premiumError } = await supabase
      .from("organizations")
      .update({ subscription_tier: "enterprise" })
      .eq("subscription_tier", "premium")
      .select("id");

    if (premiumError) {
      logger.error("[UPDATE TIER] Error updating premium tiers:", { error: premiumError });
    } else {
      logger.info(`[UPDATE TIER] Updated ${premiumOrgs?.length || 0} premium tiers to enterprise`);
    }

    const { data: standardOrgs, error: standardError } = await supabase
      .from("organizations")
      .update({ subscription_tier: "pro" })
      .eq("subscription_tier", "standard")
      .select("id");

    if (standardError) {
      logger.error("[UPDATE TIER] Error updating standard tiers:", { error: standardError });
    } else {
      logger.info(`[UPDATE TIER] Updated ${standardOrgs?.length || 0} standard tiers to pro`);
    }

    const { data: basicOrgs, error: basicError } = await supabase
      .from("organizations")
      .update({ subscription_tier: "starter" })
      .eq("subscription_tier", "basic")
      .select("id");

    if (basicError) {
      logger.error("[UPDATE TIER] Error updating basic tiers:", { error: basicError });
    } else {
      logger.info(`[UPDATE TIER] Updated ${basicOrgs?.length || 0} basic tiers to starter`);
    }

    return NextResponse.json({
      success: true,
      updated: {
        premium: premiumOrgs?.length || 0,
        standard: standardOrgs?.length || 0,
        basic: basicOrgs?.length || 0,
      },
    });
  } catch (error) {
    logger.error("[UPDATE TIER] Unexpected error:", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tiers" },
      { status: 500 }
    );
  }
}

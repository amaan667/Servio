import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context or params (already verified)
    const venueId = context.venueId || context.params?.venueId;

    // Validation
    if (!venueId) {
      return apiErrors.badRequest("Venue ID is required");
    }

    // Business logic
    // Tier information is already available in the unified context from get_access_context RPC
    // No need for additional database queries - this eliminates duplicate calls

    // DEBUG: Also log what the database actually contains
    const supabase = await createAdminClient();
    const { data: orgData } = await supabase
      .from("organizations")
      .select("subscription_tier, subscription_status, stripe_customer_id")
      .eq("owner_user_id", context.user.id)
      .maybeSingle();

    return success({
      tier: context.tier,
      status: "active", // Status is handled by the RPC logic (inactive subscriptions return 'starter' tier)
    });
  },
  {
    requireVenueAccess: true,
    venueIdSource: "params",
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

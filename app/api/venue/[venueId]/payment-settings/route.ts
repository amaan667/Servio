import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { apiErrors } from "@/lib/api/standard-response";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const venueId = context.venueId;
    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("venues")
      .select("allow_pay_at_till_for_table_collection")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (error) {
      return apiErrors.internal("Failed to fetch venue settings");
    }

    return NextResponse.json({
      ok: true,
      allow_pay_at_till_for_table_collection: data?.allow_pay_at_till_for_table_collection === true,
    });
  },
  {
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "params",
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

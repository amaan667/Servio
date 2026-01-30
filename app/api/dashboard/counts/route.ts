import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { getDashboardCounts } from "@/lib/dashboard-counts";

export const runtime = "nodejs";

export const GET = createUnifiedHandler(
  async (req: NextRequest, context) => {
    const venueId = context.venueId;
    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("tz") ?? "Europe/London";
    const liveWindowMins = parseInt(searchParams.get("live_window_mins") ?? "30", 10) || 30;

    const supabase = await createClient();
    const counts = await getDashboardCounts(supabase, {
      venueId,
      tz,
      liveWindowMins,
    });

    return success(counts);
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

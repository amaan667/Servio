import { NextResponse } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    const body = await req.json();
    const venue_id = context.venueId || body.venue_id;

    if (!venue_id) {
      return apiErrors.badRequest("venue_id required");
    }
    const { createAdminClient } = await import("@/lib/supabase");
    const admin = createAdminClient();

    const { error } = await admin.from("staff").delete().eq("venue_id", venue_id);
    if (error) return apiErrors.badRequest(error.message);
    return success({ success: true });
  } catch (_error) {
    return apiErrors.internal(_error instanceof Error ? _error.message : "Internal server error");
  }
});

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    const { searchParams } = new URL(req.url);
    const venue_id = context.venueId || searchParams.get("venue_id");
    const staff_id = searchParams.get("staff_id");
    if (!venue_id) return apiErrors.badRequest("venue_id required");

    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    let q = supabase
      .from("staff_shifts")
      .select(
        `
      id, 
      staff_id, 
      venue_id, 
      start_time, 
      end_time, 
      area,
      staff:staff_id(name, role)
    `
      )
      .eq("venue_id", venue_id)
      .order("start_time", { ascending: false });
    if (staff_id) q = q.eq("staff_id", staff_id);

    const { data, error } = await q;
    if (error) return apiErrors.badRequest(error.message);

    // Transform the data to flatten the nested staff object
    const transformedShifts =
      data?.map((shift) => {
        const staff = shift.staff as unknown;
        const staffObj = Array.isArray(staff) ? staff[0] : staff;
        const staffData =
          staffObj && typeof staffObj === "object"
            ? (staffObj as Record<string, unknown>)

              };
        return {
          ...shift,

        };
      }) || [];

    return success({ shifts: transformedShifts });
  } catch (_error) {
    return apiErrors.internal(_error instanceof Error ? _error.message : "Unknown error");
  }

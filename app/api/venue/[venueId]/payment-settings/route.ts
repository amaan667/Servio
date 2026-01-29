import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: { venueId: string } }) {
  try {
    const venueId = context.params?.venueId;
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
  } catch {
    return apiErrors.internal("Internal server error");
  }
}

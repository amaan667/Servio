import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: { venueId: string } }) {
  try {
    const venueId = context.params?.venueId;
    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("venues")
      .select("allow_pay_at_till_for_table_collection")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        ok: true,
        allow_pay_at_till_for_table_collection: false,
      });
    }

    return NextResponse.json({
      ok: true,
      allow_pay_at_till_for_table_collection: data?.allow_pay_at_till_for_table_collection === true,
    });
  } catch {
    return apiErrors.internal("Internal server error");
  }
}

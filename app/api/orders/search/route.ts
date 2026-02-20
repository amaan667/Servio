import { NextRequest, NextResponse } from "next/server";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { createServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export const GET = createUnifiedHandler(
  async (req: NextRequest, context) => {
    const supabase = await createServerSupabase();

    const { searchParams } = new URL(req.url);
    const paymentIntent = searchParams.get("payment_intent");
    const sessionId = searchParams.get("session_id");

    if (!paymentIntent && !sessionId) {
      return NextResponse.json(
        { ok: false, error: "payment_intent or session_id is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("orders")
      .select(
        "id, venue_id, table_number, customer_name, total_amount, order_status, payment_status, stripe_payment_intent_id, stripe_session_id, created_at"
      )
      .eq("venue_id", context.venueId)
      .limit(50)
      .order("created_at", { ascending: false });

    if (paymentIntent) {
      query = query.eq("stripe_payment_intent_id", paymentIntent);
    } else if (sessionId) {
      query = query.eq("stripe_session_id", sessionId);
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return {
      ok: true,
      orders: orders || [],
    };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

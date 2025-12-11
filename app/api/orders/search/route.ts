import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");
    const paymentIntent = searchParams.get("payment_intent");
    const sessionId = searchParams.get("session_id");

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venue_id is required" }, { status: 400 });
    }

    let query = supabase.from("orders").select("*").eq("venue_id", venueId);

    // Search by payment intent if provided
    if (paymentIntent) {
      query = query.eq("stripe_payment_intent_id", paymentIntent);
    }
    // Or search by session ID if provided
    else if (sessionId) {
      query = query.eq("stripe_session_id", sessionId);
    } else {
      return NextResponse.json(
        { ok: false, error: "payment_intent or session_id is required" },
        { status: 400 }
      );
    }

    const { data: orders, error } = await query;

    if (error) {
      logger.error("[ORDERS SEARCH] Database error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orders: orders || [],
    });
  } catch (_error) {
    logger.error("[ORDERS SEARCH] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

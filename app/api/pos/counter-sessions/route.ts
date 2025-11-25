import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    // Create authenticated supabase client
    const supabase = await createServerSupabase();

    // Get counter status using the function
    const { data: counterStatus, error } = await supabase.rpc("get_counter_status", {
      p_venue_id: venueId,
    });

    if (error) {
      logger.error("[POS COUNTER SESSIONS] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ counters: counterStatus });
  } catch (_error) {
    logger.error("[POS COUNTER SESSIONS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venue_id, counter_id, action, server_id, notes } = body;

    if (!venue_id || !counter_id || !action) {
      return NextResponse.json(
        { error: "venue_id, counter_id, and action are required" },
        { status: 400 }
      );
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venue_id);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    // Create authenticated supabase client
    const supabase = await createServerSupabase();

    let result;

    switch (action) {
      case "open_session":
        // Create new counter session
        const { data: session, error: sessionError } = await supabase
          .from("counter_sessions")
          .insert({
            venue_id,
            counter_id,
            server_id: server_id || null,
            notes,
            status: "ACTIVE",
          })
          .select()
          .single();

        if (sessionError) {
          logger.error("[POS COUNTER SESSIONS] Error creating session:", sessionError);
          return NextResponse.json({ error: "Failed to create counter session" }, { status: 500 });
        }

        result = { session, action: "opened" };
        break;

      case "close_session":
        // Close counter session
        const { data: closedSession, error: closeError } = await supabase
          .from("counter_sessions")
          .update({
            closed_at: new Date().toISOString(),
            status: "CLOSED",
          })
          .eq("venue_id", venue_id)
          .eq("counter_id", counter_id)
          .eq("closed_at", null)
          .select()
          .single();

        if (closeError) {
          logger.error("[POS COUNTER SESSIONS] Error closing session:", closeError);
          return NextResponse.json({ error: "Failed to close counter session" }, { status: 500 });
        }

        // Mark all active orders as completed
        const { data: counter } = await supabase
          .from("counters")
          .select("label")
          .eq("id", counter_id)
          .single();

        if (counter) {
          // CRITICAL: Verify all orders are PAID before completing
          const { data: ordersToComplete } = await supabase
            .from("orders")
            .select("id, payment_status")
            .eq("venue_id", venue_id)
            .eq("table_number", counter.label)
            .eq("source", "counter")
            .eq("is_active", true);

          const unpaidOrders = ordersToComplete?.filter(
            (order) => (order.payment_status || "").toString().toUpperCase() !== "PAID"
          ) || [];

          if (unpaidOrders.length > 0) {
            logger.warn("[POS COUNTER SESSIONS] Attempted to complete unpaid orders", {
              unpaidCount: unpaidOrders.length,
              orderIds: unpaidOrders.map((o) => o.id),
            });
            return NextResponse.json(
              {
                error: `Cannot close counter: ${unpaidOrders.length} order(s) are unpaid. Please collect payment first.`,
                unpaid_order_ids: unpaidOrders.map((o) => o.id),
              },
              { status: 400 }
            );
          }

          const { error: ordersError } = await supabase
            .from("orders")
            .update({ order_status: "COMPLETED" })
            .eq("venue_id", venue_id)
            .eq("table_number", counter.label)
            .eq("source", "counter")
            .eq("is_active", true);

          if (ordersError) {
            logger.error("[POS COUNTER SESSIONS] Error completing orders:", ordersError);
          }
        }

        result = { session: closedSession, action: "closed" };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (_error) {
    logger.error("[POS COUNTER SESSIONS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

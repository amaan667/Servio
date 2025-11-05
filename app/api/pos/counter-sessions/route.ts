import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // Create authenticated supabase client
    const supabase = await createServerSupabase();

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { venue_id, counter_id, action, server_id, notes } = body;

    if (!venue_id || !counter_id || !action) {
      return NextResponse.json(
        { error: "venue_id, counter_id, and action are required" },
        { status: 400 }
      );
    }

    // Create authenticated supabase client
    const supabase = await createServerSupabase();

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

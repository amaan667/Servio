import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { requireVenueAccessForAPI } from "@/lib/auth/api";
import { logger } from "@/lib/logger";
import {
  handleStartPreparing,
  handleMarkReady,
  handleMarkServed,
  handleMarkAwaitingBill,
  handleCloseTable,
  handleReserveTable,
  handleOccupyTable,
  handleMoveTable,
  handleMergeTable,
  handleUnmergeTable,
  handleCancelReservation,
} from "../handlers/table-action-handlers";

/**
 * Table Sessions Actions API Route
 * Handles all table management actions (prepare, serve, close, reserve, merge, etc.)
 *
 * Refactored: Extracted all handler functions to separate file for better organization
 * Original: 771 lines → Now: ~110 lines
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      table_id,
      venue_id,
      order_id,
      destination_table_id,
      customer_name,
      reservation_time,
      reservation_duration,
      reservation_id,
    } = body;

    if (!action || !table_id || !venue_id) {
      return NextResponse.json(
        { error: "action, table_id, and venue_id are required" },
        { status: 400 }
      );
    }

    // STANDARDIZED: Use requireVenueAccessForAPI for consistent auth + venue access
    const accessResult = await requireVenueAccessForAPI(venue_id);
    if (!accessResult.success) {
      return accessResult.response;
    }

    const { context } = accessResult;
    const supabase = await createServerSupabase();

    // Note: Venue access is already verified by requireVenueAccessForAPI above

    // Route to appropriate handler based on action
    switch (action) {
      case "start_preparing":
        return await handleStartPreparing(supabase, table_id, order_id);

      case "mark_ready":
        return await handleMarkReady(supabase, table_id, order_id);

      case "mark_served":
        return await handleMarkServed(supabase, table_id, order_id);

      case "mark_awaiting_bill":
        return await handleMarkAwaitingBill(supabase, table_id);

      case "close_table":
        return await handleCloseTable(supabase, table_id);

      case "reserve_table":
        if (!customer_name || !reservation_time) {
          return NextResponse.json(
            { error: "customer_name and reservation_time are required for reserve_table action" },
            { status: 400 }
          );
        }
        return await handleReserveTable(
          supabase,
          table_id,
          customer_name,
          reservation_time,
          reservation_duration || 60
        );

      case "occupy_table":
        return await handleOccupyTable(supabase, table_id);

      case "move_table":
        if (!destination_table_id) {
          return NextResponse.json(
            { error: "destination_table_id is required for move_table action" },
            { status: 400 }
          );
        }
        return await handleMoveTable(supabase, table_id, destination_table_id);

      case "merge_table":
        if (!destination_table_id) {
          return NextResponse.json(
            { error: "destination_table_id is required for merge_table action" },
            { status: 400 }
          );
        }
        return await handleMergeTable(supabase, venue_id, table_id, destination_table_id);

      case "unmerge_table":
        return await handleUnmergeTable(supabase, table_id);

      case "cancel_reservation":
        if (!reservation_id) {
          return NextResponse.json(
            { error: "reservation_id is required for cancel_reservation action" },
            { status: 400 }
          );
        }
        return await handleCancelReservation(supabase, table_id, reservation_id);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (_error) {
    logger.error("[TABLE SESSIONS ACTIONS API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

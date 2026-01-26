import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";

import { RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
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

const tableActionSchema = z.object({
  action: z.string(),
  table_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  destination_table_id: z.string().uuid().optional(),
  customer_name: z.string().optional(),
  reservation_time: z.string().optional(),
  reservation_duration: z.number().optional(),
  reservation_id: z.string().uuid().optional(),
  venue_id: z.string().optional(),
  venueId: z.string().optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context (already verified)
    const venueId = context.venueId;
    const { body } = context;
    const {
      action,
      table_id,
      order_id,
      destination_table_id,
      customer_name,
      reservation_time,
      reservation_duration,
      reservation_id,
    } = body;

    // Validate inputs
    if (!action || !table_id) {
      return apiErrors.badRequest("action and table_id are required");
    }

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Security - Verify venue access (already done by unified handler)
    // Verify table belongs to venue
    const supabase = await createServerSupabase();
    const { data: table } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", table_id)
      .eq("venue_id", venueId)
      .single();

    if (!table) {
      return apiErrors.notFound("Table not found or access denied");
    }

    // Route to appropriate handler based on action
    try {
      switch (action) {
        case "start_preparing":
          if (!order_id) {
            return apiErrors.badRequest("order_id is required for start_preparing action");
          }
          return await handleStartPreparing(supabase, table_id, order_id);

        case "mark_ready":
          if (!order_id) {
            return apiErrors.badRequest("order_id is required for mark_ready action");
          }
          return await handleMarkReady(supabase, table_id, order_id);

        case "mark_served":
          if (!order_id) {
            return apiErrors.badRequest("order_id is required for mark_served action");
          }
          return await handleMarkServed(supabase, table_id, order_id);

        case "mark_awaiting_bill":
          return await handleMarkAwaitingBill(supabase, table_id);

        case "close_table":
          return await handleCloseTable(supabase, table_id);

        case "reserve_table":
          if (!customer_name || !reservation_time) {
            return apiErrors.badRequest(
              "customer_name and reservation_time are required for reserve_table action"
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
            return apiErrors.badRequest("destination_table_id is required for move_table action");
          }
          return await handleMoveTable(supabase, table_id, destination_table_id);

        case "merge_table":
          if (!destination_table_id) {
            return apiErrors.badRequest("destination_table_id is required for merge_table action");
          }
          if (!venueId) {
            return apiErrors.badRequest("venueId is required for merge_table action");
          }
          return await handleMergeTable(supabase, venueId, table_id, destination_table_id);

        case "unmerge_table":
          return await handleUnmergeTable(supabase, table_id);

        case "cancel_reservation":
          if (!reservation_id) {
            return apiErrors.badRequest("reservation_id is required for cancel_reservation action");
          }
          return await handleCancelReservation(supabase, table_id, reservation_id);

        default:
          return apiErrors.badRequest("Invalid action");
      }
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }
      return apiErrors.internal("Request processing failed");
    }
  },
  {
    schema: tableActionSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        // Clone the request so we don't consume the original body
        const clonedReq = req.clone();
        const body = await clonedReq.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);

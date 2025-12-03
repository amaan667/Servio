import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
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

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Parse request BEFORE accessing venueId from context
      // (venueId extraction happens after body is parsed)
      const body = await req.json();

      // STEP 3: Get venueId from context (already verified)
      const venueId = context.venueId;
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

      // STEP 4: Validate inputs
      if (!action || !table_id) {
        return apiErrors.badRequest("action and table_id are required");
      }

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
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
            return apiErrors.badRequest("customer_name and reservation_time are required for reserve_table action");
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
      logger.error("[TABLE SESSIONS ACTIONS] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from body - use cloned request to avoid consuming the stream
    extractVenueId: async (req) => {
      try {
        // Clone the request so we don't consume the original body
        const clonedReq = req.clone();
        const body = await clonedReq.json().catch(() => ({}));
        return (body as { venue_id?: string; venueId?: string })?.venue_id || 
               (body as { venue_id?: string; venueId?: string })?.venueId || 
               null;
      } catch {
        return null;
      }
    },
  }
);

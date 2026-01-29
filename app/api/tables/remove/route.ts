import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const removeTablesSchema = z.object({
  tableNumbers: z
    .array(z.number().int().positive())
    .min(1, "At least one table number is required"),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body, venueId } = context;
    const { tableNumbers } = body;

    // Validation already done by unified handler schema
    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    const adminSupabase = createAdminClient();

    // Step 1: Update active orders to COMPLETED status
    const { data: updatedOrders, error: updateError } = await adminSupabase
      .from("orders")
      .update({
        order_status: "COMPLETED",
        updated_at: new Date().toISOString(),
      })
      .in("table_number", tableNumbers)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .eq("venue_id", venueId!)
      .select("id, table_number, order_status");

    if (updateError) {
      return apiErrors.database(`Failed to update orders: ${updateError.message}`);
    }

    // Step 2: Get table IDs first
    const { data: tablesToRemove, error: tablesError } = await adminSupabase
      .from("tables")
      .select("id, label")
      .in("label", tableNumbers.map(String))
      .eq("venue_id", context.venueId);

    if (tablesError) {
      return apiErrors.database(`Failed to fetch tables: ${tablesError.message}`);
    }

    const tableIdsToRemove = tablesToRemove?.map((t) => t.id) || [];

    // Step 3: Clear table_id references in orders
    const { data: clearedOrders, error: clearError } = await adminSupabase
      .from("orders")
      .update({
        table_id: null,
        updated_at: new Date().toISOString(),
      })
      .in("table_id", tableIdsToRemove)
      .eq("venue_id", venueId!)
      .select("id, table_id");

    if (clearError) {
      return apiErrors.database(`Failed to clear table references: ${clearError.message}`);
    }

    // Step 4: Remove table records
    const { data: removedTables, error: tableError } = await adminSupabase
      .from("tables")
      .delete()
      .in("id", tableIdsToRemove)
      .eq("venue_id", venueId!)
      .select("id, label");

    if (tableError) {
      return apiErrors.database(`Failed to remove tables: ${tableError.message}`);
    }

    // Step 5: Remove table sessions
    const removedTableIds = tableIdsToRemove;
    let removedSessions = [];

    if (removedTableIds.length > 0) {
      const { data: sessions, error: sessionError } = await adminSupabase
        .from("table_sessions")
        .delete()
        .in("table_id", removedTableIds)
        .eq("venue_id", venueId!)
        .select("id");

      if (sessionError) {
        return apiErrors.database(`Failed to remove table sessions: ${sessionError.message}`);
      }

      removedSessions = sessions || [];
    }

    // Step 6: Remove reservations
    let removedReservations = [];

    if (removedTableIds.length > 0) {
      const { data: reservations, error: reservationError } = await adminSupabase
        .from("reservations")
        .delete()
        .in("table_id", removedTableIds)
        .eq("venue_id", venueId!)
        .select("id");

      if (reservationError) {
        return apiErrors.database(`Failed to remove reservations: ${reservationError.message}`);
      }

      removedReservations = reservations || [];
    }

    // Step 7: Verification
    const { data: remainingTables } = await adminSupabase
      .from("tables")
      .select("id, label")
      .in("label", tableNumbers.map(String))
      .eq("venue_id", context.venueId);

    const { data: remainingOrders } = await adminSupabase
      .from("orders")
      .select("table_number, order_status")
      .in("table_number", tableNumbers)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"])
      .eq("venue_id", venueId!);

    return success({
      ok: true,
      message: `Successfully removed tables ${tableNumbers.join(", ")}`,
      data: {
        removedTables: removedTables?.length || 0,
        updatedOrders: updatedOrders?.length || 0,
        clearedOrders: clearedOrders?.length || 0,
        removedSessions: removedSessions?.length || 0,
        removedReservations: removedReservations?.length || 0,
        remainingTables: remainingTables?.length || 0,
        remainingActiveOrders: remainingOrders?.length || 0,
      },
    });
  },
  {
    schema: removeTablesSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

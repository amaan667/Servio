import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function PUT(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    const body = await req.json();
    const { label, seat_count, is_active, qr_version } = body;

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.supabase) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { supabase } = auth;

    // Update table
    const updateData: {
      label?: string;
      seat_count?: number;
      is_active?: boolean;
      updated_at: string;
      qr_version?: number;
    } = {
      label: label?.trim(),
      seat_count,
      is_active,
      updated_at: new Date().toISOString(),
    };

    if (qr_version !== undefined) {
      updateData.qr_version = qr_version;
    }

    const { data: table, error } = await supabase
      .from("tables")
      .update(updateData)
      .eq("id", tableId)
      .select()
      .single();

    if (error) {
      logger.error("[TABLES API] Error updating table:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to update table" }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (_error) {
    logger.error("[TABLES API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;

    // Check if force=true is passed as query parameter
    const url = new URL(req.url);
    const forceRemove = url.searchParams.get("force") === "true";

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.supabase || !auth.user) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { supabase, user } = auth;

    // First check if table exists
    const { data: existingTable, error: checkError } = await supabase
      .from("tables")
      .select("id, label, venue_id")
      .eq("id", tableId)
      .single();

    if (checkError || !existingTable) {
      logger.error("[TABLES API] Error checking table existence:", { value: checkError });
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Type assertion for TypeScript - we've already checked for null above
    const table = existingTable as { id: string; label: string; venue_id: string };

    // Verify venue ownership
    const access = await verifyVenueAccess(supabase, user.id, table.venue_id);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Forbidden - you don't have access to this venue" },
        { status: 403 }
      );
    }

    // Check if the table has unknown active orders

    let activeOrders: { id: string }[] = [];
    let ordersError: unknown = null;

    try {
      const ordersResult = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", tableId)
        .eq("venue_id", table.venue_id)
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

      activeOrders = ordersResult.data || [];
      ordersError = ordersResult.error;
    } catch (_error) {
      logger.error("[TABLES API] Exception during active orders check:", {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      ordersError = _error;
    }

    if (ordersError) {
      logger.error("[TABLES API] Error checking active orders:", { value: ordersError });

      // Instead of failing completely, we'll log the error and continue with a warning
      logger.warn(
        "[TABLES API] Proceeding with table removal despite orders check failure - this may be due to database connectivity issues"
      );

      // Try a simpler fallback query
      try {
        const fallbackResult = await supabase
          .from("orders")
          .select("id")
          .eq("table_id", tableId)
          .limit(1);

        if (fallbackResult.data && fallbackResult.data.length > 0) {
          logger.warn(
            "[TABLES API] Fallback query found orders for this table - proceeding with caution"
          );
        }
      } catch (fallbackError) {
        logger.error("[TABLES API] Fallback query also failed:", { value: fallbackError });
      }
    }

    // Check if the table has unknown active reservations

    let activeReservations: { id: string }[] = [];
    let reservationsError: unknown = null;

    try {
      const reservationsResult = await supabase
        .from("reservations")
        .select("id")
        .eq("table_id", tableId)
        .eq("venue_id", table.venue_id)
        .eq("status", "BOOKED");

      activeReservations = reservationsResult.data || [];
      reservationsError = reservationsResult.error;
    } catch (_error) {
      logger.error("[TABLES API] Exception during active reservations check:", {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      reservationsError = _error;
    }

    if (reservationsError) {
      logger.error("[TABLES API] Error checking active reservations:", {
        value: reservationsError,
      });

      // Instead of failing completely, we'll log the error and continue with a warning
      logger.warn(
        "[TABLES API] Proceeding with table removal despite reservations check failure - this may be due to database connectivity issues"
      );
    }

    // If there are active orders or reservations, handle based on forceRemove flag

    if (forceRemove) {
      // FORCE REMOVE: Complete all active orders and cancel reservations
      logger.info(
        "[TABLES API] Force remove enabled - completing active orders and canceling reservations"
      );

      if (!ordersError && activeOrders && activeOrders.length > 0) {
        const { error: completeOrdersError } = await supabase
          .from("orders")
          .update({
            order_status: "COMPLETED",
            updated_at: new Date().toISOString(),
          })
          .eq("table_id", tableId)
          .eq("venue_id", table.venue_id)
          .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

        if (completeOrdersError) {
          logger.error("[TABLES API] Error force completing orders:", {
            value: completeOrdersError,
          });
        } else {
          logger.info("[TABLES API] Successfully force completed active orders");
        }
      }

      if (!reservationsError && activeReservations && activeReservations.length > 0) {
        logger.info(
          `[TABLES API] Force canceling ${activeReservations.length} active reservations`
        );
        const { error: cancelReservationsError } = await supabase
          .from("reservations")
          .update({
            status: "CANCELLED",
            updated_at: new Date().toISOString(),
          })
          .eq("table_id", tableId)
          .eq("venue_id", table.venue_id)
          .eq("status", "BOOKED");

        if (cancelReservationsError) {
          logger.error("[TABLES API] Error force canceling reservations:", {
            value: cancelReservationsError,
          });
        } else {
          logger.info("[TABLES API] Successfully force canceled active reservations");
        }
      }
    } else {
      // NORMAL REMOVE: Prevent deletion if there are active orders/reservations
      // Only prevent deletion if we successfully checked and found active orders/reservations
      if (!ordersError && activeOrders && activeOrders.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot remove table with active orders. Please close all orders first.",
            hasActiveOrders: true,
          },
          { status: 400 }
        );
      }

      if (!reservationsError && activeReservations && activeReservations.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot remove table with active reservations. Please cancel all reservations first.",
            hasActiveReservations: true,
          },
          { status: 400 }
        );
      }
    }

    // If both checks failed, we'll proceed with a warning
    if (ordersError && reservationsError) {
      logger.warn(
        "[TABLES API] Both orders and reservations checks failed - proceeding with table removal but logging the issue"
      );
    }

    // Clear table_id references in orders to avoid foreign key constraint issues
    const { error: clearTableRefsError } = await supabase
      .from("orders")
      .update({ table_id: null })
      .eq("table_id", tableId)
      .eq("venue_id", table.venue_id);

    if (clearTableRefsError) {
      logger.error("[TABLES API] Error clearing table references in orders:", {
        value: clearTableRefsError,
      });
      // Continue with deletion anyway - this might be due to RLS or other issues
      logger.warn(
        "[TABLES API] Proceeding with table deletion despite table reference clear failure"
      );
    }

    // Delete table sessions first (if they exist)
    const { error: deleteSessionsError } = await supabase
      .from("table_sessions")
      .delete()
      .eq("table_id", tableId)
      .eq("venue_id", table.venue_id);

    if (deleteSessionsError) {
      logger.error("[TABLES API] Error deleting table sessions:", { value: deleteSessionsError });
      // Continue with table deletion anyway
      logger.warn("[TABLES API] Proceeding with table deletion despite session deletion failure");
    }

    // Note: table_runtime_state is a view that aggregates data from table_sessions and tables
    // Since we already deleted table_sessions above, the runtime state will be automatically updated

    // Delete group sessions for this table
    const { error: deleteGroupSessionError } = await supabase
      .from("table_group_sessions")
      .delete()
      .eq("table_number", table.label) // Use table label/number to match group sessions
      .eq("venue_id", table.venue_id);

    if (deleteGroupSessionError) {
      logger.error("[TABLES API] Error deleting group sessions:", {
        value: deleteGroupSessionError,
      });
      // Continue with table deletion anyway
      logger.warn(
        "[TABLES API] Proceeding with table deletion despite group session deletion failure"
      );
    }

    // Finally, delete the table itself using admin client to bypass RLS
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from("tables")
      .delete()
      .eq("id", tableId)
      .eq("venue_id", table.venue_id);

    if (error) {
      logger.error("[TABLES API] Error deleting table:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      logger.error("[TABLES API] Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedTable: table });
  } catch (_error) {
    logger.error("[TABLES API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

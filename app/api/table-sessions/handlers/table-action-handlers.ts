import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Table Action Handlers
 * Extracted from the main route for better organization
 */

export async function handleStartPreparing(
  supabase: SupabaseClient,
  table_id: string,
  order_id: string
) {
  // Update order status to IN_PREP
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      order_status: "IN_PREP",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order_id);

  if (orderError) {
    logger.error("[TABLE ACTIONS] Error updating order status:", { value: orderError });
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({
      status: "IN_PREP",
      updated_at: new Date().toISOString(),
    })
    .eq("table_id", table_id)
    .eq("order_id", order_id);

  if (sessionError) {
    logger.error("[TABLE ACTIONS] Error updating session status:", { value: sessionError });
    return NextResponse.json({ error: "Failed to update session status" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function handleMarkReady(
  supabase: SupabaseClient,
  table_id: string,
  order_id: string
) {
  // Update order status to READY
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      order_status: "READY",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order_id);

  if (orderError) {
    logger.error("[TABLE ACTIONS] Error updating order status:", { value: orderError });
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({
      status: "READY",
      updated_at: new Date().toISOString(),
    })
    .eq("table_id", table_id)
    .eq("order_id", order_id);

  if (sessionError) {
    logger.error("[TABLE ACTIONS] Error updating session status:", { value: sessionError });
    return NextResponse.json({ error: "Failed to update session status" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function handleMarkServed(
  supabase: SupabaseClient,
  table_id: string,
  order_id: string
) {
  // Update order status to SERVED
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      order_status: "SERVED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order_id);

  if (orderError) {
    logger.error("[TABLE ACTIONS] Error updating order status:", { value: orderError });
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({
      status: "SERVED",
      updated_at: new Date().toISOString(),
    })
    .eq("table_id", table_id)
    .eq("order_id", order_id);

  if (sessionError) {
    logger.error("[TABLE ACTIONS] Error updating session status:", { value: sessionError });
    return NextResponse.json({ error: "Failed to update session status" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function handleMarkAwaitingBill(supabase: SupabaseClient, table_id: string) {
  // Update table session status to AWAITING_BILL
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({
      status: "AWAITING_BILL",
      updated_at: new Date().toISOString(),
    })
    .eq("table_id", table_id)
    .is("closed_at", null);

  if (sessionError) {
    logger.error("[TABLE ACTIONS] Error updating session status:", { value: sessionError });
    return NextResponse.json({ error: "Failed to update session status" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function handleCloseTable(supabase: SupabaseClient, table_id: string) {
  try {
    // Get the venue_id and current order for the table
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", table_id)
      .single();

    if (tableError || !table) {
      logger.error("[TABLE ACTIONS] Error fetching table for close:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Get current session with order details
    const { data: currentSession } = await supabase
      .from("table_sessions")
      .select("order_id, order_status, payment_status")
      .eq("table_id", table_id)
      .is("closed_at", null)
      .single();

    // If there's an active order and it's PAID, mark it as COMPLETED
    if (currentSession?.order_id && currentSession.payment_status === "PAID") {
      logger.info("[TABLE ACTIONS] Order is paid, marking as COMPLETED before closing table", {
        orderId: currentSession.order_id,
      });

      const { error: completeError } = await supabase
        .from("orders")
        .update({
          order_status: "COMPLETED",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentSession.order_id);

      if (completeError) {
        logger.error("[TABLE ACTIONS] Error completing order:", { value: completeError });
        // Continue with table close anyway
      }
    }

    // Close the current session
    const { data: sessionData, error: sessionError } = await supabase
      .from("table_sessions")
      .update({
        status: "CLOSED",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("table_id", table_id)
      .is("closed_at", null)
      .select();

    if (sessionError) {
      logger.error("[TABLE ACTIONS] Error closing session:", { value: sessionError });
      return NextResponse.json({ error: "Failed to close session" }, { status: 500 });
    }

    // Create a new FREE session for the table
    const { data: newSessionData, error: newSessionError } = await supabase
      .from("table_sessions")
      .insert({
        table_id: table_id,
        venue_id: table.venue_id,
        status: "FREE",
        opened_at: new Date().toISOString(),
      })
      .select();

    if (newSessionError) {
      logger.error("[TABLE ACTIONS] Error creating new FREE session:", { value: newSessionError });
      return NextResponse.json({ error: "Failed to create new session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        closed_session: sessionData,
        new_session: newSessionData,
      },
    });
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error closing table:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function handleReserveTable(
  supabase: SupabaseClient,
  table_id: string,
  customer_name: string,
  reservation_time: string,
  reservation_duration: number = 60
) {
  try {
    // Get venue_id from table
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", table_id)
      .single();

    if (tableError || !table) {
      logger.error("[TABLE ACTIONS] Error fetching table for reservation:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });

      if (tableError.code === "PGRST116") {
        const { data: allTables } = await supabase
          .from("tables")
          .select("id, label, venue_id")
          .limit(10);

        return NextResponse.json(
          {
            error: "Table not found",
            debug: {
              requestedTableId: table_id,
              availableTables: allTables,
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Check if there's already an active session/reservation for this table
    const { data: existingSession, error: sessionCheckError } = await supabase
      .from("table_sessions")
      .select("id, status, reservation_time")
      .eq("table_id", table_id)
      .is("closed_at", null)
      .single();

    if (sessionCheckError && sessionCheckError.code !== "PGRST116") {
      logger.error("[TABLE ACTIONS] Error checking existing session:", {
        value: sessionCheckError,
      });
      return NextResponse.json({ error: "Failed to check table availability" }, { status: 500 });
    }

    // If there's an active session, check if it's a reservation
    if (existingSession) {
      if (existingSession.status === "RESERVED") {
        const existingTime = existingSession.reservation_time;
        const requestedTime = new Date(reservation_time);

        if (existingTime) {
          const existingReservationTime = new Date(existingTime);
          const timeDiff = Math.abs(requestedTime.getTime() - existingReservationTime.getTime());
          const conflictWindow = 30 * 60 * 1000; // 30 minutes in milliseconds

          if (timeDiff < conflictWindow) {
            return NextResponse.json(
              {
                error: "Table is already reserved at this time. Please choose a different time.",
                conflict: {
                  existingTime: existingTime,
                  requestedTime: reservation_time,
                },
              },
              { status: 409 }
            );
          }
        } else {
          return NextResponse.json(
            {
              error: "Table is already reserved. Please choose a different table or time.",
            },
            { status: 409 }
          );
        }
      } else if (
        ["ORDERING", "IN_PREP", "READY", "SERVED", "AWAITING_BILL"].includes(existingSession.status)
      ) {
        return NextResponse.json(
          {
            error: "Table is currently in use. Please choose a different table.",
          },
          { status: 409 }
        );
      }
    }

    // Also check the reservations table for additional validation
    const { data: existingReservation, error: checkError } = await supabase
      .from("reservations")
      .select("id, start_at, end_at")
      .eq("table_id", table_id)
      .eq("status", "BOOKED")
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      logger.error("[TABLE ACTIONS] Error checking existing reservation:", { value: checkError });
      return NextResponse.json({ error: "Failed to check existing reservation" }, { status: 500 });
    }

    // Create or update reservation
    if (existingReservation) {
      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          customer_name: customer_name,
          start_at: reservation_time,
          end_at: new Date(
            new Date(reservation_time).getTime() + reservation_duration * 60 * 1000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingReservation.id);

      if (updateError) {
        logger.error("[TABLE ACTIONS] Error updating reservation:", { value: updateError });
        return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
      }
    } else {
      const { error: reservationError } = await supabase.from("reservations").insert({
        venue_id: table.venue_id,
        table_id: table_id,
        customer_name: customer_name,
        start_at: reservation_time,
        end_at: new Date(
          new Date(reservation_time).getTime() + reservation_duration * 60 * 1000
        ).toISOString(),
        status: "BOOKED",
        created_at: new Date().toISOString(),
      });

      if (reservationError) {
        logger.error("[TABLE ACTIONS] Error creating reservation:", { value: reservationError });
      }
    }

    // Update or create table session status to RESERVED and store reservation info
    const { data: currentSession, error: currentSessionError } = await supabase
      .from("table_sessions")
      .select("id, status")
      .eq("table_id", table_id)
      .is("closed_at", null)
      .maybeSingle();

    if (currentSessionError) {
      logger.error("[TABLE ACTIONS] Error checking existing session:", {
        value: currentSessionError,
      });
      return NextResponse.json({ error: "Failed to check existing session" }, { status: 500 });
    }

    if (currentSession) {
      const { error: sessionError } = await supabase
        .from("table_sessions")
        .update({
          status: "RESERVED",
          customer_name: customer_name,
          reservation_time: reservation_time,
          reservation_duration_minutes: reservation_duration,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentSession.id);

      if (sessionError) {
        logger.error("[TABLE ACTIONS] Error updating session status:", { value: sessionError });
        return NextResponse.json({ error: "Failed to update session status" }, { status: 500 });
      }
    } else {
      const { error: sessionError } = await supabase.from("table_sessions").insert({
        table_id: table_id,
        venue_id: table.venue_id,
        status: "RESERVED",
        customer_name: customer_name,
        reservation_time: reservation_time,
        reservation_duration_minutes: reservation_duration,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (sessionError) {
        logger.error("[TABLE ACTIONS] Error creating session:", { value: sessionError });
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error in handleReserveTable:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error in reservation" }, { status: 500 });
  }
}

export async function handleOccupyTable(supabase: SupabaseClient, table_id: string) {
  // First, check if there's an existing open session
  const { data: existingSession, error: checkError } = await supabase
    .from("table_sessions")
    .select("id, status")
    .eq("table_id", table_id)
    .is("closed_at", null)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    logger.error("[TABLE ACTIONS] Error checking existing session:", { value: checkError });
    return NextResponse.json({ error: "Failed to check table status" }, { status: 500 });
  }

  if (existingSession) {
    const { error: updateError } = await supabase
      .from("table_sessions")
      .update({
        status: "ORDERING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSession.id);

    if (updateError) {
      logger.error("[TABLE ACTIONS] Error updating session to ORDERING:", { value: updateError });
      return NextResponse.json({ error: "Failed to occupy table" }, { status: 500 });
    }
  } else {
    // Get venue_id from table
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", table_id)
      .single();

    if (tableError) {
      logger.error("[TABLE ACTIONS] Error getting table info:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });
      if (tableError.code === "PGRST116") {
        const { data: allTables } = await supabase
          .from("tables")
          .select("id, label, venue_id")
          .limit(10);

        return NextResponse.json(
          {
            error: "Table not found in database",
            debug: {
              requestedTableId: table_id,
              availableTables: allTables,
              errorCode: tableError.code,
              errorMessage: tableError.message,
            },
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: "Failed to get table info" }, { status: 500 });
    }

    if (!table) {
      logger.error("[TABLE ACTIONS] Table not found for ID:", { value: table_id });
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { error: createError } = await supabase.from("table_sessions").insert({
      table_id: table_id,
      venue_id: table.venue_id,
      status: "ORDERING",
      opened_at: new Date().toISOString(),
    });

    if (createError) {
      logger.error("[TABLE ACTIONS] Error creating new ORDERING session:", { value: createError });
      return NextResponse.json({ error: "Failed to occupy table" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function handleMoveTable(
  supabase: SupabaseClient,
  table_id: string,
  destination_table_id: string
) {
  // Get current session
  const { data: currentSession, error: sessionError } = await supabase
    .from("table_sessions")
    .select("*")
    .eq("table_id", table_id)
    .is("closed_at", null)
    .single();

  if (sessionError || !currentSession) {
    logger.error("[TABLE ACTIONS] Error fetching current session:", { value: sessionError });
    return NextResponse.json({ error: "No active session found for table" }, { status: 400 });
  }

  // Check if destination table is FREE
  const { data: destSession, error: destError } = await supabase
    .from("table_sessions")
    .select("*")
    .eq("table_id", destination_table_id)
    .is("closed_at", null)
    .single();

  if (destError || !destSession || destSession.status !== "FREE") {
    return NextResponse.json({ error: "Destination table is not available" }, { status: 400 });
  }

  // Close current session
  const { error: closeError } = await supabase
    .from("table_sessions")
    .update({
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentSession.id);

  if (closeError) {
    logger.error("[TABLE ACTIONS] Error closing current session:", { value: closeError });
    return NextResponse.json({ error: "Failed to close current session" }, { status: 500 });
  }

  // Update destination session with current session data
  const { error: updateError } = await supabase
    .from("table_sessions")
    .update({
      status: currentSession.status,
      order_id: currentSession.order_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", destSession.id);

  if (updateError) {
    logger.error("[TABLE ACTIONS] Error updating destination session:", { value: updateError });
    return NextResponse.json({ error: "Failed to update destination session" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function handleMergeTable(
  supabase: SupabaseClient,
  venue_id: string,
  table_id: string,
  destination_table_id: string
) {
  try {
    const { data, error } = await supabase.rpc("api_merge_tables", {
      p_venue_id: venue_id,
      p_table_a: table_id,
      p_table_b: destination_table_id,
    });

    if (error) {
      logger.error("[TABLE ACTIONS] Error merging tables:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        { error: error.message || "Failed to merge tables" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error merging tables:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function handleUnmergeTable(supabase: SupabaseClient, table_id: string) {
  try {
    // Get the current table info to understand its state
    const { data: currentTable, error: currentTableError } = await supabase
      .from("tables")
      .select("id, label, seat_count, merged_with_table_id, venue_id")
      .eq("id", table_id)
      .single();

    if (currentTableError || !currentTable) {
      logger.error("[TABLE ACTIONS] Error getting current table:", { value: currentTableError });
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Check if this table has a merged_with_table_id (it's a secondary table)
    if (currentTable.merged_with_table_id) {
      const { data, error } = await supabase.rpc("api_unmerge_table", {
        p_secondary_table_id: table_id,
      });

      if (error) {
        logger.error("[TABLE ACTIONS] Error unmerging table:", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          { error: error.message || "Failed to unmerge table" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
      });
    }

    // If this is a primary table, look for the secondary table
    const { data: secondaryTable, error: findError } = await supabase
      .from("tables")
      .select("id, label, seat_count, merged_with_table_id, venue_id")
      .eq("merged_with_table_id", table_id)
      .single();

    if (findError && findError.code !== "PGRST116") {
      logger.error("[TABLE ACTIONS] Error finding secondary table:", { value: findError });
      return NextResponse.json({ error: "Failed to find merged table" }, { status: 500 });
    }

    if (secondaryTable) {
      const { data, error } = await supabase.rpc("api_unmerge_table", {
        p_secondary_table_id: secondaryTable.id,
      });

      if (error) {
        logger.error("[TABLE ACTIONS] Error unmerging table:", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return NextResponse.json(
          { error: error.message || "Failed to unmerge table" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
      });
    }

    return NextResponse.json({ error: "No merged table found for this table" }, { status: 404 });
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error unmerging table:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function handleCancelReservation(
  supabase: SupabaseClient,
  table_id: string,
  reservation_id: string
) {
  try {
    // First, cancel the reservation in the reservations table (if it exists)
    const { error: reservationError } = await supabase
      .from("reservations")
      .update({
        status: "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation_id);

    if (reservationError) {
      // Don't fail if reservations table doesn't exist, just log the error
    }

    // Get the current table session
    const { data: currentSession, error: sessionError } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("table_id", table_id)
      .is("closed_at", null)
      .single();

    if (sessionError) {
      logger.error("[TABLE ACTIONS] Error fetching current session:", { value: sessionError });
      return NextResponse.json({ error: "Failed to fetch table session" }, { status: 500 });
    }

    if (!currentSession) {
      logger.error("[TABLE ACTIONS] No active session found for table:", { value: table_id });
      return NextResponse.json({ error: "No active session found" }, { status: 404 });
    }

    // Close the current session
    const { error: closeError } = await supabase
      .from("table_sessions")
      .update({
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentSession.id);

    if (closeError) {
      logger.error("[TABLE ACTIONS] Error closing session:", { value: closeError });
      return NextResponse.json({ error: "Failed to close session" }, { status: 500 });
    }

    // Create a new FREE session for the table
    const { data: newSessionData, error: newSessionError } = await supabase
      .from("table_sessions")
      .insert({
        table_id: table_id,
        venue_id: currentSession.venue_id,
        status: "FREE",
        opened_at: new Date().toISOString(),
      })
      .select();

    if (newSessionError) {
      logger.error("[TABLE ACTIONS] Error creating new FREE session:", { value: newSessionError });
      return NextResponse.json({ error: "Failed to create new session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        cancelled_session: currentSession,
        new_session: newSessionData,
      },
    });
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error cancelling reservation:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

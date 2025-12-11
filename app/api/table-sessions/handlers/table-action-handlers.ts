import { NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
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
    return apiErrors.internal("Failed to update order status");
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
    return apiErrors.internal("Failed to update session status");
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
    return apiErrors.internal("Failed to update order status");
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
    return apiErrors.internal("Failed to update session status");
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
    return apiErrors.internal("Failed to update order status");
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
    return apiErrors.internal("Failed to update session status");
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
    return apiErrors.internal("Failed to update session status");
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
      return apiErrors.notFound("Table not found");
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
      return apiErrors.internal("Failed to close session");
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
      return apiErrors.internal("Failed to create new session");
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
    return apiErrors.internal("Internal server error");
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

      return apiErrors.notFound("Table not found");
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
      return apiErrors.internal("Failed to check table availability");
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
      return apiErrors.internal("Failed to check existing reservation");
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
        return apiErrors.internal("Failed to update reservation");
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
      return apiErrors.internal("Failed to check existing session");
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
        return apiErrors.internal("Failed to update session status");
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
        return apiErrors.internal("Failed to create session");
      }
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error in handleReserveTable:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal("Internal server error in reservation");
  }
}

export async function handleOccupyTable(supabase: SupabaseClient, table_id: string) {
  console.log("[OCCUPY TABLE] Starting - table_id:", table_id);

  // First, check if there's an existing open session
  const { data: existingSession, error: checkError } = await supabase
    .from("table_sessions")
    .select("id, status")
    .eq("table_id", table_id)
    .is("closed_at", null)
    .single();

  console.log("[OCCUPY TABLE] Session check:", { existingSession, error: checkError?.message });

  if (checkError && checkError.code !== "PGRST116") {
    console.log("[OCCUPY TABLE] ERROR checking session:", checkError);
    logger.error("[TABLE ACTIONS] Error checking existing session:", { value: checkError });
    return apiErrors.internal("Failed to check table status");
  }

  // Get venue_id from table first
  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("venue_id")
    .eq("id", table_id)
    .single();

  console.log("[OCCUPY TABLE] Table lookup:", { table, error: tableError?.message });

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
    return apiErrors.internal("Failed to get table info");
  }

  if (!table) {
    logger.error("[TABLE ACTIONS] Table not found for ID:", { value: table_id });
    return apiErrors.notFound("Table not found");
  }

  if (existingSession) {
    console.log("[OCCUPY TABLE] Updating existing session to OCCUPIED");
    // Update existing session to OCCUPIED
    const { error: updateError } = await supabase
      .from("table_sessions")
      .update({
        status: "OCCUPIED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSession.id);

    console.log("[OCCUPY TABLE] Update result:", {
      error: updateError?.message,
      success: !updateError,
    });

    if (updateError) {
      console.log("[OCCUPY TABLE] ERROR updating session:", updateError);
      logger.error("[TABLE ACTIONS] Error updating session to OCCUPIED:", { value: updateError });
      return apiErrors.internal("Failed to occupy table");
    }
  } else {
    console.log("[OCCUPY TABLE] Creating new OCCUPIED session");
    // Create new session with OCCUPIED status
    const { error: createError } = await supabase.from("table_sessions").insert({
      table_id: table_id,
      venue_id: table.venue_id,
      status: "OCCUPIED",
      opened_at: new Date().toISOString(),
    });

    console.log("[OCCUPY TABLE] Create result:", {
      error: createError?.message,
      success: !createError,
    });

    if (createError) {
      console.log("[OCCUPY TABLE] ERROR creating session:", createError);
      logger.error("[TABLE ACTIONS] Error creating new OCCUPIED session:", {
        value: createError,
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        tableId: table_id,
        venueId: table.venue_id,
      });
      return apiErrors.internal(
        `Failed to occupy table: ${createError.message || "Unknown error"}`
      );
    }
  }

  console.log("[OCCUPY TABLE] SUCCESS - Returning success response");
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
    return apiErrors.badRequest("No active session found for table");
  }

  // Cannot move FREE tables (no session to transfer)
  if (currentSession.status === "FREE") {
    return NextResponse.json(
      { error: "Cannot move a FREE table - no active session to transfer" },
      { status: 400 }
    );
  }

  // Check if destination table is FREE
  const { data: destSession, error: destError } = await supabase
    .from("table_sessions")
    .select("*")
    .eq("table_id", destination_table_id)
    .is("closed_at", null)
    .single();

  if (destError || !destSession || destSession.status !== "FREE") {
    return apiErrors.badRequest("Destination table must be FREE");
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
    return apiErrors.internal("Failed to close current session");
  }

  // Update destination session with current session data
  const { error: updateError } = await supabase
    .from("table_sessions")
    .update({
      status: currentSession.status,
      order_id: currentSession.order_id,
      customer_name: currentSession.customer_name,
      total_amount: currentSession.total_amount,
      payment_status: currentSession.payment_status,
      order_status: currentSession.order_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", destSession.id);

  if (updateError) {
    logger.error("[TABLE ACTIONS] Error updating destination session:", { value: updateError });
    return apiErrors.internal("Failed to update destination session");
  }

  // Update the order's table_id to point to new table
  if (currentSession.order_id) {
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        table_id: destination_table_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentSession.order_id);

    if (orderUpdateError) {
      logger.error("[TABLE ACTIONS] Error updating order table_id:", { value: orderUpdateError });
      // Continue anyway - session was moved successfully
    }
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
    return apiErrors.internal("Internal server error");
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
      return apiErrors.notFound("Table not found");
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
      return apiErrors.internal("Failed to find merged table");
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

    return apiErrors.notFound("No merged table found for this table");
  } catch (_error) {
    logger.error("[TABLE ACTIONS] Unexpected _error unmerging table:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal("Internal server error");
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
      return apiErrors.internal("Failed to fetch table session");
    }

    if (!currentSession) {
      logger.error("[TABLE ACTIONS] No active session found for table:", { value: table_id });
      return apiErrors.notFound("No active session found");
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
      return apiErrors.internal("Failed to close session");
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
      return apiErrors.internal("Failed to create new session");
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
    return apiErrors.internal("Internal server error");
  }
}

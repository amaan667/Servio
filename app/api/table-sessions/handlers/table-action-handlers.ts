import { NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Table Action Handlers
 * Extracted from the main route for better organization
 */

export async function handleStartPreparing(

  const { error: orderError } = await supabase
    .from("orders")
    .update({

    .eq("id", order_id);

  if (orderError) {
    
    return apiErrors.internal("Failed to update order status");
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({

    .eq("table_id", table_id)
    .eq("order_id", order_id);

  if (sessionError) {
    
    return apiErrors.internal("Failed to update session status");
  }

  return NextResponse.json({ success: true });
}

export async function handleMarkReady(

  const { error: orderError } = await supabase
    .from("orders")
    .update({

    .eq("id", order_id);

  if (orderError) {
    
    return apiErrors.internal("Failed to update order status");
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({

    .eq("table_id", table_id)
    .eq("order_id", order_id);

  if (sessionError) {
    
    return apiErrors.internal("Failed to update session status");
  }

  return NextResponse.json({ success: true });
}

export async function handleMarkServed(

  const { error: orderError } = await supabase
    .from("orders")
    .update({

    .eq("id", order_id);

  if (orderError) {
    
    return apiErrors.internal("Failed to update order status");
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({

    .eq("table_id", table_id)
    .eq("order_id", order_id);

  if (sessionError) {
    
    return apiErrors.internal("Failed to update session status");
  }

  return NextResponse.json({ success: true });
}

export async function handleMarkAwaitingBill(supabase: SupabaseClient, table_id: string) {
  // Update table session status to AWAITING_BILL
  const { error: sessionError } = await supabase
    .from("table_sessions")
    .update({

    .eq("table_id", table_id)
    .is("closed_at", null);

  if (sessionError) {
    
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
      

      const { error: completeError } = await supabase
        .from("orders")
        .update({

        .eq("id", currentSession.order_id);

      if (completeError) {
        
        // Continue with table close anyway
      }
    }

    // Close the current session
    const { data: sessionData, error: sessionError } = await supabase
      .from("table_sessions")
      .update({

      .eq("table_id", table_id)
      .is("closed_at", null)
      .select();

    if (sessionError) {
      
      return apiErrors.internal("Failed to close session");
    }

    // Create a new FREE session for the table
    const { data: newSessionData, error: newSessionError } = await supabase
      .from("table_sessions")
      .insert({

      .select();

    if (newSessionError) {
      
      return apiErrors.internal("Failed to create new session");
    }

    return NextResponse.json({

      },

  } catch (_error) {
    
    return apiErrors.internal("Internal server error");
  }
}

export async function handleReserveTable(

    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", table_id)
      .single();

    if (tableError || !table) {
      

      if (tableError.code === "PGRST116") {
        const { data: allTables } = await supabase
          .from("tables")
          .select("id, label, venue_id")
          .limit(10);

        return NextResponse.json(
          {

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

                },
              },
              { status: 409 }
            );
          }
        } else {
          return NextResponse.json(
            {

            },
            { status: 409 }
          );
        }
      } else if (
        ["ORDERING", "IN_PREP", "READY", "SERVED", "AWAITING_BILL"].includes(existingSession.status)
      ) {
        return NextResponse.json(
          {

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
      
      return apiErrors.internal("Failed to check existing reservation");
    }

    // Create or update reservation
    if (existingReservation) {
      const { error: updateError } = await supabase
        .from("reservations")
        .update({

        .eq("id", existingReservation.id);

      if (updateError) {
        
        return apiErrors.internal("Failed to update reservation");
      }
    } else {
      const { error: reservationError } = await supabase.from("reservations").insert({

      if (reservationError) {
        
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
      
      return apiErrors.internal("Failed to check existing session");
    }

    if (currentSession) {
      const { error: sessionError } = await supabase
        .from("table_sessions")
        .update({

        .eq("id", currentSession.id);

      if (sessionError) {
        
        return apiErrors.internal("Failed to update session status");
      }
    } else {
      const { error: sessionError } = await supabase.from("table_sessions").insert({

      if (sessionError) {
        
        return apiErrors.internal("Failed to create session");
      }
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    
    return apiErrors.internal("Internal server error in reservation");
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
    
    return apiErrors.internal("Failed to check table status");
  }

  // Get venue_id from table first
  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("venue_id")
    .eq("id", table_id)
    .single();

  

  if (tableError) {
    
    if (tableError.code === "PGRST116") {
      const { data: allTables } = await supabase
        .from("tables")
        .select("id, label, venue_id")
        .limit(10);

      return NextResponse.json(
        {

          },
        },
        { status: 404 }
      );
    }
    return apiErrors.internal("Failed to get table info");
  }

  if (!table) {
    
    return apiErrors.notFound("Table not found");
  }

  if (existingSession) {
    
    // Update existing session to OCCUPIED
    const { error: updateError } = await supabase
      .from("table_sessions")
      .update({

      .eq("id", existingSession.id);

    

    if (updateError) {
      
      return apiErrors.internal("Failed to occupy table");
    }
  } else {
    
    // Create new session with OCCUPIED status
    const { error: createError } = await supabase.from("table_sessions").insert({

    if (createError) {
      
      return apiErrors.internal(
        `Failed to occupy table: ${createError.message || "Unknown error"}`
      );
    }
  }

  
  return NextResponse.json({ success: true });
}

export async function handleMoveTable(

  const { data: currentSession, error: sessionError } = await supabase
    .from("table_sessions")
    .select("*")
    .eq("table_id", table_id)
    .is("closed_at", null)
    .single();

  if (sessionError || !currentSession) {
    
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

    .eq("id", currentSession.id);

  if (closeError) {
    
    return apiErrors.internal("Failed to close current session");
  }

  // Update destination session with current session data
  const { error: updateError } = await supabase
    .from("table_sessions")
    .update({

    .eq("id", destSession.id);

  if (updateError) {
    
    return apiErrors.internal("Failed to update destination session");
  }

  // Update the order's table_id to point to new table
  if (currentSession.order_id) {
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({

      .eq("id", currentSession.order_id);

    if (orderUpdateError) {
      
      // Continue anyway - session was moved successfully
    }
  }

  return NextResponse.json({ success: true });
}

export async function handleMergeTable(

    const { data, error } = await supabase.rpc("api_merge_tables", {

    if (error) {
      
      return NextResponse.json(
        { error: error.message || "Failed to merge tables" },
        { status: 400 }
      );
    }

    return NextResponse.json({

  } catch (_error) {
    
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
      
      return apiErrors.notFound("Table not found");
    }

    // Check if this table has a merged_with_table_id (it's a secondary table)
    if (currentTable.merged_with_table_id) {
      const { data, error } = await supabase.rpc("api_unmerge_table", {

      if (error) {
        
        return NextResponse.json(
          { error: error.message || "Failed to unmerge table" },
          { status: 400 }
        );
      }

      return NextResponse.json({

    }

    // If this is a primary table, look for the secondary table
    const { data: secondaryTable, error: findError } = await supabase
      .from("tables")
      .select("id, label, seat_count, merged_with_table_id, venue_id")
      .eq("merged_with_table_id", table_id)
      .single();

    if (findError && findError.code !== "PGRST116") {
      
      return apiErrors.internal("Failed to find merged table");
    }

    if (secondaryTable) {
      const { data, error } = await supabase.rpc("api_unmerge_table", {

      if (error) {
        
        return NextResponse.json(
          { error: error.message || "Failed to unmerge table" },
          { status: 400 }
        );
      }

      return NextResponse.json({

    }

    return apiErrors.notFound("No merged table found for this table");
  } catch (_error) {
    
    return apiErrors.internal("Internal server error");
  }
}

export async function handleCancelReservation(

    // First, cancel the reservation in the reservations table (if it exists)
    const { error: reservationError } = await supabase
      .from("reservations")
      .update({

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
      
      return apiErrors.internal("Failed to fetch table session");
    }

    if (!currentSession) {
      
      return apiErrors.notFound("No active session found");
    }

    // Close the current session
    const { error: closeError } = await supabase
      .from("table_sessions")
      .update({

      .eq("id", currentSession.id);

    if (closeError) {
      
      return apiErrors.internal("Failed to close session");
    }

    // Create a new FREE session for the table
    const { data: newSessionData, error: newSessionError } = await supabase
      .from("table_sessions")
      .insert({

      .select();

    if (newSessionError) {
      
      return apiErrors.internal("Failed to create new session");
    }

    return NextResponse.json({

      },

  } catch (_error) {
    
    return apiErrors.internal("Internal server error");
  }
}

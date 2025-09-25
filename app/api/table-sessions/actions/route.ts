import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, table_id, venue_id, order_id, destination_table_id, customer_name, reservation_time, reservation_duration, reservation_id } = body;


    if (!action || !table_id || !venue_id) {
      return NextResponse.json({ error: 'action, table_id, and venue_id are required' }, { status: 400 });
    }

    // Check authentication
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }


    // Use admin client for table operations to bypass RLS
    const supabase = createAdminClient();

    // Verify venue ownership
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, owner_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: 'Access denied to venue' }, { status: 403 });
    }


    switch (action) {
      case 'start_preparing':
        return await handleStartPreparing(supabase, table_id, order_id);
      
      case 'mark_ready':
        return await handleMarkReady(supabase, table_id, order_id);
      
      case 'mark_served':
        return await handleMarkServed(supabase, table_id, order_id);
      
      case 'mark_awaiting_bill':
        return await handleMarkAwaitingBill(supabase, table_id);
      
      case 'close_table':
        return await handleCloseTable(supabase, table_id);
      
      case 'reserve_table':
        if (!customer_name || !reservation_time) {
          return NextResponse.json({ error: 'customer_name and reservation_time are required for reserve_table action' }, { status: 400 });
        }
        return await handleReserveTable(supabase, table_id, customer_name, reservation_time, reservation_duration || 60);
      
      case 'occupy_table':
        return await handleOccupyTable(supabase, table_id);
      
      case 'move_table':
        if (!destination_table_id) {
          return NextResponse.json({ error: 'destination_table_id is required for move_table action' }, { status: 400 });
        }
        return await handleMoveTable(supabase, table_id, destination_table_id);
      
      case 'merge_table':
        if (!destination_table_id) {
          return NextResponse.json({ error: 'destination_table_id is required for merge_table action' }, { status: 400 });
        }
        return await handleMergeTable(supabase, venue_id, table_id, destination_table_id);
      
      case 'unmerge_table':
        return await handleUnmergeTable(supabase, table_id);
      
      case 'cancel_reservation':
        if (!reservation_id) {
          return NextResponse.json({ error: 'reservation_id is required for cancel_reservation action' }, { status: 400 });
        }
        return await handleCancelReservation(supabase, table_id, reservation_id);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[TABLE SESSIONS ACTIONS API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleStartPreparing(supabase: any, table_id: string, order_id: string) {
  // Update order status to IN_PREP
  const { error: orderError } = await supabase
    .from('orders')
    .update({ 
      order_status: 'IN_PREP',
      updated_at: new Date().toISOString()
    })
    .eq('id', order_id);

  if (orderError) {
    console.error('[TABLE ACTIONS] Error updating order status:', orderError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'IN_PREP',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .eq('order_id', order_id);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkReady(supabase: any, table_id: string, order_id: string) {
  // Update order status to READY
  const { error: orderError } = await supabase
    .from('orders')
    .update({ 
      order_status: 'READY',
      updated_at: new Date().toISOString()
    })
    .eq('id', order_id);

  if (orderError) {
    console.error('[TABLE ACTIONS] Error updating order status:', orderError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'READY',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .eq('order_id', order_id);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkServed(supabase: any, table_id: string, order_id: string) {
  // Update order status to SERVED
  const { error: orderError } = await supabase
    .from('orders')
    .update({ 
      order_status: 'SERVED',
      updated_at: new Date().toISOString()
    })
    .eq('id', order_id);

  if (orderError) {
    console.error('[TABLE ACTIONS] Error updating order status:', orderError);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }

  // Update table session status
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'SERVED',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .eq('order_id', order_id);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkAwaitingBill(supabase: any, table_id: string) {
  // Update table session status to AWAITING_BILL
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'AWAITING_BILL',
      updated_at: new Date().toISOString()
    })
    .eq('table_id', table_id)
    .is('closed_at', null);

  if (sessionError) {
    console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleCloseTable(supabase: any, table_id: string) {
  try {
    
    // Get the venue_id for the table
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('venue_id')
      .eq('id', table_id)
      .single();

    if (tableError || !table) {
      console.error('[TABLE ACTIONS] Error fetching table for close:', tableError);
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Close the current session
    const { data: sessionData, error: sessionError } = await supabase
      .from('table_sessions')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('table_id', table_id)
      .is('closed_at', null)
      .select();

    if (sessionError) {
      console.error('[TABLE ACTIONS] Error closing session:', sessionError);
      return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
    }


    // Create a new FREE session for the table
    const { data: newSessionData, error: newSessionError } = await supabase
      .from('table_sessions')
      .insert({
        table_id: table_id,
        venue_id: table.venue_id,
        status: 'FREE',
        opened_at: new Date().toISOString()
      })
      .select();

    if (newSessionError) {
      console.error('[TABLE ACTIONS] Error creating new FREE session:', newSessionError);
      return NextResponse.json({ error: 'Failed to create new session' }, { status: 500 });
    }


    return NextResponse.json({ 
      success: true, 
      data: {
        closed_session: sessionData,
        new_session: newSessionData
      }
    });
  } catch (error) {
    console.error('[TABLE ACTIONS] Unexpected error closing table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleReserveTable(supabase: any, table_id: string, customer_name: string, reservation_time: string, reservation_duration: number = 60) {
  
  try {
    // Get venue_id from table
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('venue_id')
      .eq('id', table_id)
      .single();

  if (tableError || !table) {
    console.error('[TABLE ACTIONS] Error fetching table for reservation:', tableError);
    
    if (tableError.code === 'PGRST116') {
      // Let's see what tables actually exist
      const { data: allTables, error: allTablesError } = await supabase
        .from('tables')
        .select('id, label, venue_id')
        .limit(10);
      
      
      return NextResponse.json({ 
        error: 'Table not found',
        debug: {
          requestedTableId: table_id,
          availableTables: allTables
        }
      }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  // Check if there's already an active session/reservation for this table
  const { data: existingSession, error: sessionCheckError } = await supabase
    .from('table_sessions')
    .select('id, status, reservation_time')
    .eq('table_id', table_id)
    .is('closed_at', null)
    .single();

  if (sessionCheckError && sessionCheckError.code !== 'PGRST116') {
    console.error('[TABLE ACTIONS] Error checking existing session:', sessionCheckError);
    return NextResponse.json({ error: 'Failed to check table availability' }, { status: 500 });
  }

  // If there's an active session, check if it's a reservation
  if (existingSession) {
    if (existingSession.status === 'RESERVED') {
      const existingTime = existingSession.reservation_time;
      const requestedTime = new Date(reservation_time);
      
      // Check if the requested time conflicts with existing reservation
      if (existingTime) {
        const existingReservationTime = new Date(existingTime);
        const timeDiff = Math.abs(requestedTime.getTime() - existingReservationTime.getTime());
        const conflictWindow = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        if (timeDiff < conflictWindow) {
          return NextResponse.json({ 
            error: 'Table is already reserved at this time. Please choose a different time.',
            conflict: {
              existingTime: existingTime,
              requestedTime: reservation_time
            }
          }, { status: 409 });
        }
      } else {
        // If there's a reserved session without a specific time, block the reservation
        return NextResponse.json({ 
          error: 'Table is already reserved. Please choose a different table or time.'
        }, { status: 409 });
      }
    } else if (existingSession.status === 'ORDERING' || existingSession.status === 'IN_PREP' || existingSession.status === 'READY' || existingSession.status === 'SERVED' || existingSession.status === 'AWAITING_BILL') {
      // Table is currently in use
      return NextResponse.json({ 
        error: 'Table is currently in use. Please choose a different table.'
      }, { status: 409 });
    }
  }

  // Also check the reservations table for additional validation
  const { data: existingReservation, error: checkError } = await supabase
    .from('reservations')
    .select('id, start_at, end_at')
    .eq('table_id', table_id)
    .eq('status', 'BOOKED')
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('[TABLE ACTIONS] Error checking existing reservation:', checkError);
    return NextResponse.json({ error: 'Failed to check existing reservation' }, { status: 500 });
  }

  // Create or update reservation
  if (existingReservation) {
    // Update existing reservation
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        customer_name: customer_name,
        start_at: reservation_time,
        end_at: new Date(new Date(reservation_time).getTime() + reservation_duration * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingReservation.id);

    if (updateError) {
      console.error('[TABLE ACTIONS] Error updating reservation:', updateError);
      return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
    }
  } else {
    // Create new reservation
    const { error: reservationError } = await supabase
      .from('reservations')
      .insert({
        venue_id: table.venue_id,
        table_id: table_id,
        customer_name: customer_name,
        start_at: reservation_time,
        end_at: new Date(new Date(reservation_time).getTime() + reservation_duration * 60 * 1000).toISOString(),
        status: 'BOOKED',
        created_at: new Date().toISOString()
      });

    if (reservationError) {
      console.error('[TABLE ACTIONS] Error creating reservation:', reservationError);
      // Don't fail if reservations table doesn't exist, just log the error
    }
  }

  // Update or create table session status to RESERVED and store reservation info
  
  const { data: currentSession, error: currentSessionError } = await supabase
    .from('table_sessions')
    .select('id, status')
    .eq('table_id', table_id)
    .is('closed_at', null)
    .maybeSingle();

  if (currentSessionError) {
    console.error('[TABLE ACTIONS] Error checking existing session:', currentSessionError);
    return NextResponse.json({ error: 'Failed to check existing session' }, { status: 500 });
  }


  if (currentSession) {
    // Update existing session
    const { error: sessionError } = await supabase
      .from('table_sessions')
      .update({ 
        status: 'RESERVED',
        customer_name: customer_name,
        reservation_time: reservation_time,
        reservation_duration_minutes: reservation_duration,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);

    if (sessionError) {
      console.error('[TABLE ACTIONS] Error updating session status:', sessionError);
      console.error('[TABLE ACTIONS] Session update details:', {
        sessionId: currentSession.id,
        tableId: table_id,
        currentStatus: currentSession.status,
        error: sessionError
      });
      return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
    }
  } else {
    // Create new session
    const { error: sessionError } = await supabase
      .from('table_sessions')
      .insert({
        table_id: table_id,
        venue_id: table.venue_id,
        status: 'RESERVED',
        customer_name: customer_name,
        reservation_time: reservation_time,
        reservation_duration_minutes: reservation_duration,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (sessionError) {
      console.error('[TABLE ACTIONS] Error creating session:', sessionError);
      console.error('[TABLE ACTIONS] Session creation details:', {
        tableId: table_id,
        venueId: table.venue_id,
        error: sessionError
      });
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TABLE ACTIONS] Unexpected error in handleReserveTable:', error);
    return NextResponse.json({ error: 'Internal server error in reservation' }, { status: 500 });
  }
}

async function handleOccupyTable(supabase: any, table_id: string) {
  
  // First, check if there's an existing open session
  const { data: existingSession, error: checkError } = await supabase
    .from('table_sessions')
    .select('id, status')
    .eq('table_id', table_id)
    .is('closed_at', null)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[TABLE ACTIONS] Error checking existing session:', checkError);
    return NextResponse.json({ error: 'Failed to check table status' }, { status: 500 });
  }

  if (existingSession) {
    // Update existing session to ORDERING
    const { error: updateError } = await supabase
      .from('table_sessions')
      .update({ 
        status: 'ORDERING',
        updated_at: new Date().toISOString()
      })
      .eq('id', existingSession.id);

    if (updateError) {
      console.error('[TABLE ACTIONS] Error updating session to ORDERING:', updateError);
      return NextResponse.json({ error: 'Failed to occupy table' }, { status: 500 });
    }
  } else {
    // Create new session with ORDERING status
    
    // Get venue_id from table
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('venue_id')
      .eq('id', table_id)
      .single();

    if (tableError) {
      console.error('[TABLE ACTIONS] Error getting table info:', tableError);
      if (tableError.code === 'PGRST116') {
        // Let's see what tables actually exist
        const { data: allTables, error: allTablesError } = await supabase
          .from('tables')
          .select('id, label, venue_id')
          .limit(10);
        
        
        // Also check what venues exist
        const { data: allVenues, error: venuesError } = await supabase
          .from('venues')
          .select('venue_id, name')
          .limit(10);
        
        
        return NextResponse.json({ 
          error: 'Table not found in database',
          debug: {
            requestedTableId: table_id,
            availableTables: allTables,
            availableVenues: allVenues,
            errorCode: tableError.code,
            errorMessage: tableError.message
          }
        }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to get table info' }, { status: 500 });
    }

    if (!table) {
      console.error('[TABLE ACTIONS] Table not found for ID:', table_id);
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const { error: createError } = await supabase
      .from('table_sessions')
      .insert({
        table_id: table_id,
        venue_id: table.venue_id,
        status: 'ORDERING',
        opened_at: new Date().toISOString()
      });

    if (createError) {
      console.error('[TABLE ACTIONS] Error creating new ORDERING session:', createError);
      return NextResponse.json({ error: 'Failed to occupy table' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

async function handleMoveTable(supabase: any, table_id: string, destination_table_id: string) {
  // Get current session
  const { data: currentSession, error: sessionError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('table_id', table_id)
    .is('closed_at', null)
    .single();

  if (sessionError || !currentSession) {
    console.error('[TABLE ACTIONS] Error fetching current session:', sessionError);
    return NextResponse.json({ error: 'No active session found for table' }, { status: 400 });
  }

  // Check if destination table is FREE
  const { data: destSession, error: destError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('table_id', destination_table_id)
    .is('closed_at', null)
    .single();

  if (destError || !destSession || destSession.status !== 'FREE') {
    return NextResponse.json({ error: 'Destination table is not available' }, { status: 400 });
  }

  // Close current session
  const { error: closeError } = await supabase
    .from('table_sessions')
    .update({ 
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', currentSession.id);

  if (closeError) {
    console.error('[TABLE ACTIONS] Error closing current session:', closeError);
    return NextResponse.json({ error: 'Failed to close current session' }, { status: 500 });
  }

  // Update destination session with current session data
  const { error: updateError } = await supabase
    .from('table_sessions')
    .update({ 
      status: currentSession.status,
      order_id: currentSession.order_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', destSession.id);

  if (updateError) {
    console.error('[TABLE ACTIONS] Error updating destination session:', updateError);
    return NextResponse.json({ error: 'Failed to update destination session' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleMergeTable(supabase: any, venue_id: string, table_id: string, destination_table_id: string) {
  try {

    // Use the database RPC function for proper merge logic
    const { data, error } = await supabase.rpc('api_merge_tables', {
      p_venue_id: venue_id,
      p_table_a: table_id,
      p_table_b: destination_table_id
    });


    if (error) {
      console.error('[TABLE ACTIONS] Error merging tables:', error);
      return NextResponse.json({ error: error.message || 'Failed to merge tables' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: data 
    });
  } catch (error) {
    console.error('[TABLE ACTIONS] Unexpected error merging tables:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleUnmergeTable(supabase: any, table_id: string) {
  try {
    
    // Get the current table info to understand its state
    const { data: currentTable, error: currentTableError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id, venue_id')
      .eq('id', table_id)
      .single();

    if (currentTableError || !currentTable) {
      console.error('[TABLE ACTIONS] Error getting current table:', currentTableError);
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }


    // Check if this table has a merged_with_table_id (it's a secondary table)
    if (currentTable.merged_with_table_id) {
      
      // Use the database RPC function for unmerge
      const { data, error } = await supabase.rpc('api_unmerge_table', {
        p_secondary_table_id: table_id
      });

      if (error) {
        console.error('[TABLE ACTIONS] Error unmerging table:', error);
        return NextResponse.json({ error: error.message || 'Failed to unmerge table' }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        data: data 
      });
    }

    // If this is a primary table, look for the secondary table
    const { data: secondaryTable, error: findError } = await supabase
      .from('tables')
      .select('id, label, seat_count, merged_with_table_id, venue_id')
      .eq('merged_with_table_id', table_id)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('[TABLE ACTIONS] Error finding secondary table:', findError);
      return NextResponse.json({ error: 'Failed to find merged table' }, { status: 500 });
    }

    if (secondaryTable) {
      
      // Use the database RPC function for unmerge with the secondary table ID
      const { data, error } = await supabase.rpc('api_unmerge_table', {
        p_secondary_table_id: secondaryTable.id
      });

      if (error) {
        console.error('[TABLE ACTIONS] Error unmerging table:', error);
        return NextResponse.json({ error: error.message || 'Failed to unmerge table' }, { status: 400 });
      }

      return NextResponse.json({ 
        success: true, 
        data: data 
      });
    }

    // If no secondary table found with merged_with_table_id, this might be an old-style merge
    // Try to handle it manually by parsing the label
    if (currentTable.label && currentTable.label.includes(' merged with ')) {
      
      // Parse the merged label to extract the original table numbers
      const parts = currentTable.label.split(' merged with ');
      const firstTableNum = parts[0].replace(/\D/g, '');
      const secondTableNum = parts[1].replace(/\D/g, '');
      
      
      // Look for tables with these numbers in the same venue
      const { data: allTables, error: allTablesError } = await supabase
        .from('tables')
        .select('id, label, seat_count')
        .eq('venue_id', currentTable.venue_id)
        .is('merged_with_table_id', null);
      
      if (allTablesError) {
        console.error('[TABLE ACTIONS] Error fetching all tables:', allTablesError);
        return NextResponse.json({ error: 'Failed to fetch tables for manual unmerge' }, { status: 500 });
      }
      
      // Find tables that match the original numbers
      const firstTable = allTables?.find((t: any) => t.label.includes(firstTableNum) && t.id !== table_id);
      const secondTable = allTables?.find((t: any) => t.label.includes(secondTableNum) && t.id !== table_id);
      
      if (firstTable && secondTable) {
        
        // Restore the current table to the first table's original state
        const { error: updateError } = await supabase
          .from('tables')
          .update({
            label: firstTable.label,
            seat_count: 2, // Default seat count
            updated_at: new Date().toISOString()
          })
          .eq('id', table_id);
        
        if (updateError) {
          console.error('[TABLE ACTIONS] Error updating primary table:', updateError);
          return NextResponse.json({ error: 'Failed to restore primary table' }, { status: 500 });
        }
        
        // Restore the second table
        const { error: updateSecondError } = await supabase
          .from('tables')
          .update({
            label: secondTable.label,
            seat_count: 2, // Default seat count
            updated_at: new Date().toISOString()
          })
          .eq('id', secondTable.id);
        
        if (updateSecondError) {
          console.error('[TABLE ACTIONS] Error updating secondary table:', updateSecondError);
          return NextResponse.json({ error: 'Failed to restore secondary table' }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          data: {
            unmerged_tables: [
              { id: table_id, label: firstTable.label },
              { id: secondTable.id, label: secondTable.label }
            ]
          }
        });
      }
    }

    return NextResponse.json({ error: 'No merged table found for this table' }, { status: 404 });
  } catch (error) {
    console.error('[TABLE ACTIONS] Unexpected error unmerging table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCancelReservation(supabase: any, table_id: string, reservation_id: string) {
  try {
    
    // First, cancel the reservation in the reservations table (if it exists)
    const { error: reservationError } = await supabase
      .from('reservations')
      .update({ 
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation_id);

    if (reservationError) {
      // Don't fail if reservations table doesn't exist, just log the error
    }

    // Get the current table session
    const { data: currentSession, error: sessionError } = await supabase
      .from('table_sessions')
      .select('*')
      .eq('table_id', table_id)
      .is('closed_at', null)
      .single();

    if (sessionError) {
      console.error('[TABLE ACTIONS] Error fetching current session:', sessionError);
      return NextResponse.json({ error: 'Failed to fetch table session' }, { status: 500 });
    }

    if (!currentSession) {
      console.error('[TABLE ACTIONS] No active session found for table:', table_id);
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    // Close the current session
    const { error: closeError } = await supabase
      .from('table_sessions')
      .update({
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSession.id);

    if (closeError) {
      console.error('[TABLE ACTIONS] Error closing session:', closeError);
      return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
    }

    // Create a new FREE session for the table
    const { data: newSessionData, error: newSessionError } = await supabase
      .from('table_sessions')
      .insert({
        table_id: table_id,
        venue_id: currentSession.venue_id,
        status: 'FREE',
        opened_at: new Date().toISOString()
      })
      .select();

    if (newSessionError) {
      console.error('[TABLE ACTIONS] Error creating new FREE session:', newSessionError);
      return NextResponse.json({ error: 'Failed to create new session' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        cancelled_session: currentSession,
        new_session: newSessionData
      }
    });
  } catch (error) {
    console.error('[TABLE ACTIONS] Unexpected error cancelling reservation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

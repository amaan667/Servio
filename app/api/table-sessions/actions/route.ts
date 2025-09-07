import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, table_id, venue_id, order_id, destination_table_id, customer_name, reservation_time } = body;

    console.log('[TABLE ACTIONS API] Request received:', {
      action,
      table_id,
      venue_id,
      order_id,
      destination_table_id,
      customer_name,
      reservation_time,
      timestamp: new Date().toISOString()
    });

    if (!action || !table_id || !venue_id) {
      console.log('[TABLE ACTIONS API] Missing required fields:', { action, table_id, venue_id });
      return NextResponse.json({ error: 'action, table_id, and venue_id are required' }, { status: 400 });
    }

    // Check authentication
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      console.log('[TABLE ACTIONS API] Authentication failed:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[TABLE ACTIONS API] Authenticated user:', user.id);

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
      console.log('[TABLE ACTIONS API] Venue ownership verification failed:', venueError);
      return NextResponse.json({ error: 'Access denied to venue' }, { status: 403 });
    }

    console.log('[TABLE ACTIONS API] Venue ownership verified for:', venue_id);

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
        return await handleReserveTable(supabase, table_id, customer_name, reservation_time);
      
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
    console.log('[TABLE ACTIONS] Starting close table for table_id:', table_id);
    
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

    console.log('[TABLE ACTIONS] Closed session:', sessionData);

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

    console.log('[TABLE ACTIONS] Created new FREE session:', newSessionData);

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

async function handleReserveTable(supabase: any, table_id: string, customer_name: string, reservation_time: string) {
  console.log('[TABLE ACTIONS] Starting reserve table for:', { table_id, customer_name, reservation_time });
  
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
      
      console.log('[TABLE ACTIONS] Available tables for reservation:', allTables);
      
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

  // Create reservation
  const { error: reservationError } = await supabase
    .from('reservations')
    .insert({
      venue_id: table.venue_id,
      table_id: table_id,
      customer_name: customer_name,
      start_at: reservation_time,
      end_at: new Date(new Date(reservation_time).getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
      status: 'BOOKED',
      created_at: new Date().toISOString()
    });

  if (reservationError) {
    console.error('[TABLE ACTIONS] Error creating reservation:', reservationError);
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }

  // Update table session status to RESERVED and store reservation info
  const { error: sessionError } = await supabase
    .from('table_sessions')
    .update({ 
      status: 'RESERVED',
      customer_name: customer_name,
      reservation_time: reservation_time,
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

async function handleOccupyTable(supabase: any, table_id: string) {
  console.log('[TABLE ACTIONS] Starting occupy table for table_id:', table_id);
  console.log('[TABLE ACTIONS] Table ID type:', typeof table_id);
  console.log('[TABLE ACTIONS] Table ID length:', table_id?.length);
  
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
    console.log('[TABLE ACTIONS] Updating existing session:', existingSession.id, 'to ORDERING');
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
    console.log('[TABLE ACTIONS] No existing session found, creating new ORDERING session');
    
    // Get venue_id from table
    console.log('[TABLE ACTIONS] Looking for table with ID:', table_id);
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
        
        console.log('[TABLE ACTIONS] Available tables in database:', allTables);
        console.log('[TABLE ACTIONS] Looking for table ID:', table_id);
        
        // Also check what venues exist
        const { data: allVenues, error: venuesError } = await supabase
          .from('venues')
          .select('venue_id, name')
          .limit(10);
        
        console.log('[TABLE ACTIONS] Available venues in database:', allVenues);
        
        return NextResponse.json({ 
          error: 'Table not found in database',
          debug: {
            requestedTableId: table_id,
            requestedVenueId: venueId,
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

  console.log('[TABLE ACTIONS] Table occupied successfully');
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
    console.log('[TABLE ACTIONS] Starting merge table process:', {
      venue_id,
      table_id,
      destination_table_id,
      timestamp: new Date().toISOString()
    });

    // Use the database RPC function for proper merge logic
    const { data, error } = await supabase.rpc('api_merge_tables', {
      p_venue_id: venue_id,
      p_table_a: table_id,
      p_table_b: destination_table_id
    });

    console.log('[TABLE ACTIONS] RPC call result:', { data, error });

    if (error) {
      console.error('[TABLE ACTIONS] Error merging tables:', error);
      return NextResponse.json({ error: error.message || 'Failed to merge tables' }, { status: 400 });
    }

    console.log('[TABLE ACTIONS] Merge completed successfully:', data);
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
  } catch (error) {
    console.error('[TABLE ACTIONS] Unexpected error unmerging table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

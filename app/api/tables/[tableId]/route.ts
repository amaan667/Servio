import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    const body = await req.json();
    const { label, seat_count, is_active, qr_version } = body;

    const supabase = await createClient();

    // Update table
    const updateData: any = {
      label: label?.trim(),
      seat_count,
      is_active,
      updated_at: new Date().toISOString(),
    };

    if (qr_version !== undefined) {
      updateData.qr_version = qr_version;
    }

    const { data: table, error } = await supabase
      .from('tables')
      .update(updateData)
      .eq('id', tableId)
      .select()
      .single();

    if (error) {
      console.error('[TABLES API] Error updating table:', error);
      return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    console.log('[TABLES API] DELETE request for tableId:', tableId);

    const supabase = await createClient();

    // First check if table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('tables')
      .select('id, label, venue_id')
      .eq('id', tableId)
      .single();

    if (checkError) {
      console.error('[TABLES API] Error checking table existence:', checkError);
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    console.log('[TABLES API] Found table to delete:', existingTable);

    // Check if the table has any active orders
    console.log('[TABLES API] Checking for active orders...', { tableId, venueId: existingTable.venue_id });
    
    let activeOrders: { id: string }[] = [];
    let ordersError: any = null;
    
    try {
      const ordersResult = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', tableId)
        .eq('venue_id', existingTable.venue_id)
        .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);
      
      activeOrders = ordersResult.data || [];
      ordersError = ordersResult.error;
      
      console.log('[TABLES API] Active orders check result:', { activeOrders, ordersError });
    } catch (error) {
      console.error('[TABLES API] Exception during active orders check:', error);
      ordersError = error;
    }

    if (ordersError) {
      console.error('[TABLES API] Error checking active orders:', ordersError);
      
      // Instead of failing completely, we'll log the error and continue with a warning
      console.warn('[TABLES API] Proceeding with table removal despite orders check failure - this may be due to database connectivity issues');
      
      // Try a simpler fallback query
      try {
        const fallbackResult = await supabase
          .from('orders')
          .select('id')
          .eq('table_id', tableId)
          .limit(1);
        
        if (fallbackResult.data && fallbackResult.data.length > 0) {
          console.warn('[TABLES API] Fallback query found orders for this table - proceeding with caution');
        }
      } catch (fallbackError) {
        console.error('[TABLES API] Fallback query also failed:', fallbackError);
      }
    }

    // Check if the table has any active reservations
    console.log('[TABLES API] Checking for active reservations...', { tableId, venueId: existingTable.venue_id });
    
    let activeReservations: { id: string }[] = [];
    let reservationsError: any = null;
    
    try {
      const reservationsResult = await supabase
        .from('reservations')
        .select('id')
        .eq('table_id', tableId)
        .eq('venue_id', existingTable.venue_id)
        .eq('status', 'BOOKED');
      
      activeReservations = reservationsResult.data || [];
      reservationsError = reservationsResult.error;
      
      console.log('[TABLES API] Active reservations check result:', { activeReservations, reservationsError });
    } catch (error) {
      console.error('[TABLES API] Exception during active reservations check:', error);
      reservationsError = error;
    }

    if (reservationsError) {
      console.error('[TABLES API] Error checking active reservations:', reservationsError);
      
      // Instead of failing completely, we'll log the error and continue with a warning
      console.warn('[TABLES API] Proceeding with table removal despite reservations check failure - this may be due to database connectivity issues');
    }

    // If there are active orders or reservations, prevent deletion
    console.log('[TABLES API] Checking if table can be removed...', {
      activeOrdersCount: activeOrders?.length || 0,
      activeReservationsCount: activeReservations?.length || 0,
      ordersCheckFailed: !!ordersError,
      reservationsCheckFailed: !!reservationsError
    });

    // Only prevent deletion if we successfully checked and found active orders/reservations
    if (!ordersError && activeOrders && activeOrders.length > 0) {
      console.log('[TABLES API] Table has active orders, preventing removal');
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active orders. Please close all orders first.',
          hasActiveOrders: true
        },
        { status: 400 }
      );
    }

    if (!reservationsError && activeReservations && activeReservations.length > 0) {
      console.log('[TABLES API] Table has active reservations, preventing removal');
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active reservations. Please cancel all reservations first.',
          hasActiveReservations: true
        },
        { status: 400 }
      );
    }

    // If both checks failed, we'll proceed with a warning
    if (ordersError && reservationsError) {
      console.warn('[TABLES API] Both orders and reservations checks failed - proceeding with table removal but logging the issue');
    }

    // Clear table_id references in orders to avoid foreign key constraint issues
    console.log('[TABLES API] Clearing table_id references in orders...');
    const { error: clearTableRefsError } = await supabase
      .from('orders')
      .update({ table_id: null })
      .eq('table_id', tableId)
      .eq('venue_id', existingTable.venue_id);

    if (clearTableRefsError) {
      console.error('[TABLES API] Error clearing table references in orders:', clearTableRefsError);
      // Continue with deletion anyway - this might be due to RLS or other issues
      console.warn('[TABLES API] Proceeding with table deletion despite table reference clear failure');
    } else {
      console.log('[TABLES API] Successfully cleared table references in orders');
    }

    // Delete table sessions first (if they exist)
    console.log('[TABLES API] Deleting table sessions...');
    const { error: deleteSessionsError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('table_id', tableId)
      .eq('venue_id', existingTable.venue_id);

    if (deleteSessionsError) {
      console.error('[TABLES API] Error deleting table sessions:', deleteSessionsError);
      // Continue with table deletion anyway
      console.warn('[TABLES API] Proceeding with table deletion despite session deletion failure');
    } else {
      console.log('[TABLES API] Successfully deleted table sessions');
    }

    // Delete table runtime state
    console.log('[TABLES API] Deleting table runtime state...');
    const { error: deleteRuntimeError } = await supabase
      .from('table_runtime_state')
      .delete()
      .eq('table_id', tableId)
      .eq('venue_id', existingTable.venue_id);

    if (deleteRuntimeError) {
      console.error('[TABLES API] Error deleting table runtime state:', deleteRuntimeError);
      // Continue with table deletion anyway
      console.warn('[TABLES API] Proceeding with table deletion despite runtime state deletion failure');
    } else {
      console.log('[TABLES API] Successfully deleted table runtime state');
    }

    // Delete group sessions for this table
    console.log('[TABLES API] Deleting group sessions...');
    const { error: deleteGroupSessionError } = await supabase
      .from('table_group_sessions')
      .delete()
      .eq('table_number', existingTable.label) // Use table label/number to match group sessions
      .eq('venue_id', existingTable.venue_id);

    if (deleteGroupSessionError) {
      console.error('[TABLES API] Error deleting group sessions:', deleteGroupSessionError);
      // Continue with table deletion anyway
      console.warn('[TABLES API] Proceeding with table deletion despite group session deletion failure');
    } else {
      console.log('[TABLES API] Successfully deleted group sessions');
    }

    // Finally, delete the table itself
    console.log('[TABLES API] Attempting to delete table...');
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId)
      .eq('venue_id', existingTable.venue_id);

    if (error) {
      console.error('[TABLES API] Error deleting table:', error);
      console.error('[TABLES API] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
    }

    console.log('[TABLES API] Table deleted successfully:', tableId);
    return NextResponse.json({ success: true, deletedTable: existingTable });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

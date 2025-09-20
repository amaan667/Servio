import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🔍 [API] Remove table endpoint called');
    
    const { tableId, venueId, force = false } = await request.json();
    console.log('🔍 [API] Request data:', { tableId, venueId, force });

    if (!tableId || !venueId) {
      console.log('🔍 [API] Missing required fields');
      return NextResponse.json(
        { error: 'Table ID and Venue ID are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    console.log('🔍 [API] Supabase client created');

    // Check if the table exists and belongs to the venue
    console.log('🔍 [API] Checking if table exists...');
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, label, venue_id')
      .eq('id', tableId)
      .eq('venue_id', venueId)
      .single();

    console.log('🔍 [API] Table query result:', { table, tableError });

    if (tableError || !table) {
      console.log('🔍 [API] Table not found or error:', tableError);
      return NextResponse.json(
        { error: 'Table not found or does not belong to this venue' },
        { status: 404 }
      );
    }

    // Check if the table has any active orders or reservations
    // First, get the table number from the table record
    // Handle merged tables (e.g., "4+6" or "6 (merged with 4)")
    let tableNumbers: number[] = [];
    
    if (table.label.includes('+')) {
      // Merged table like "4+6" - extract both numbers
      const numbers = table.label.split('+').map((part: string) => parseInt(part.replace(/\D/g, ''))).filter(n => !isNaN(n));
      tableNumbers = numbers;
    } else if (table.label.includes('(merged with')) {
      // Secondary merged table like "6 (merged with 4)" - extract the first number
      const firstNumber = parseInt(table.label.split(' ')[0].replace(/\D/g, ''));
      if (!isNaN(firstNumber)) {
        tableNumbers = [firstNumber];
      }
    } else {
      // Regular table - extract single number
      const tableNumber = parseInt(table.label.replace(/\D/g, '')) || null;
      if (tableNumber) {
        tableNumbers = [tableNumber];
      }
    }
    
    console.log('🔍 [API] Table numbers extracted:', tableNumbers);
    console.log('🔍 [API] Checking for active orders...', { tableId, venueId, tableNumbers });
    
    let activeOrders: { id: string }[] = [];
    let ordersError: any = null;
    
    try {
      // Check for orders by table_number
      const ordersQuery = supabase
        .from('orders')
        .select('id, table_number, order_status')
        .eq('venue_id', venueId)
        .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

      // If we have table numbers, check by table_number
      if (tableNumbers && tableNumbers.length > 0) {
        ordersQuery.in('table_number', tableNumbers);
      }

      const ordersResult = await ordersQuery;
      activeOrders = ordersResult.data || [];
      ordersError = ordersResult.error;
      
      console.log('🔍 [API] Active orders check result:', { 
        activeOrders, 
        ordersError,
        tableNumbers,
        tableId,
        ordersFound: activeOrders.length
      });
    } catch (error) {
      console.error('🔍 [API] Exception during active orders check:', error);
      ordersError = error;
    }

    if (ordersError) {
      console.error('🔍 [API] Error checking active orders:', ordersError);
      console.error('Orders query details:', {
        tableId,
        venueId,
        tableNumbers,
        error: ordersError
      });
      
      // Instead of failing completely, we'll log the error and continue with a warning
      console.warn('🔍 [API] Proceeding with table removal despite orders check failure - this may be due to database connectivity issues');
    }

    console.log('🔍 [API] Checking for active reservations...', { tableId, venueId });
    
    let activeReservations: { id: string }[] = [];
    let reservationsError: any = null;
    
    try {
      const reservationsResult = await supabase
        .from('reservations')
        .select('id')
        .eq('table_id', tableId)
        .eq('venue_id', venueId)
        .eq('status', 'BOOKED');
      
      activeReservations = reservationsResult.data || [];
      reservationsError = reservationsResult.error;
      
      console.log('🔍 [API] Active reservations check result:', { activeReservations, reservationsError });
    } catch (error) {
      console.error('🔍 [API] Exception during active reservations check:', error);
      reservationsError = error;
    }

    if (reservationsError) {
      console.error('🔍 [API] Error checking active reservations:', reservationsError);
      console.error('Reservations query details:', {
        tableId,
        venueId,
        error: reservationsError
      });
      
      // Instead of failing completely, we'll log the error and continue with a warning
      console.warn('🔍 [API] Proceeding with table removal despite reservations check failure - this may be due to database connectivity issues');
    }

    // If there are active orders or reservations, prevent deletion
    console.log('🔍 [API] Checking if table can be removed...', {
      activeOrdersCount: activeOrders?.length || 0,
      activeReservationsCount: activeReservations?.length || 0,
      ordersCheckFailed: !!ordersError,
      reservationsCheckFailed: !!reservationsError
    });

    // Only prevent deletion if we successfully checked and found active orders/reservations
    // Unless force is true
    if (!force && !ordersError && activeOrders && activeOrders.length > 0) {
      console.log('🔍 [API] Table has active orders, preventing removal');
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active orders. Please close all orders first.',
          hasActiveOrders: true
        },
        { status: 400 }
      );
    }

    if (!force && !reservationsError && activeReservations && activeReservations.length > 0) {
      console.log('🔍 [API] Table has active reservations, preventing removal');
      return NextResponse.json(
        { 
          error: 'Cannot remove table with active reservations. Please cancel all reservations first.',
          hasActiveReservations: true
        },
        { status: 400 }
      );
    }

    // If force is true and there are active orders/reservations, complete/cancel them first
    if (force && activeOrders && activeOrders.length > 0) {
      console.log('🔍 [API] Force mode: completing active orders before removal');
      const { error: completeOrdersError } = await supabase
        .from('orders')
        .update({ 
          order_status: 'COMPLETED',
          updated_at: new Date().toISOString()
        })
        .in('id', activeOrders.map(o => o.id));

      if (completeOrdersError) {
        console.error('🔍 [API] Error completing orders in force mode:', completeOrdersError);
        return NextResponse.json(
          { error: 'Failed to complete active orders' },
          { status: 500 }
        );
      }
    }

    if (force && activeReservations && activeReservations.length > 0) {
      console.log('🔍 [API] Force mode: canceling active reservations before removal');
      const { error: cancelReservationsError } = await supabase
        .from('reservations')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .in('id', activeReservations.map(r => r.id));

      if (cancelReservationsError) {
        console.error('🔍 [API] Error canceling reservations in force mode:', cancelReservationsError);
        return NextResponse.json(
          { error: 'Failed to cancel active reservations' },
          { status: 500 }
        );
      }
    }

    // If both checks failed, we'll proceed with a warning
    if (ordersError && reservationsError) {
      console.warn('🔍 [API] Both orders and reservations checks failed - proceeding with table removal but logging the issue');
    }

    // Clear table references from orders before deleting the table
    console.log('🔍 [API] Clearing table references from orders before deletion...');
    const { error: clearTableRefsError } = await supabase
      .from('orders')
      .update({ table_id: null })
      .eq('table_id', tableId)
      .eq('venue_id', venueId);

    if (clearTableRefsError) {
      console.error('🔍 [API] Error clearing table references:', clearTableRefsError);
      return NextResponse.json(
        { error: 'Failed to clear table references from orders' },
        { status: 500 }
      );
    }
    console.log('🔍 [API] Cleared table references from orders');

    // Delete the table
    console.log('🔍 [API] Attempting to delete table...');
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId)
      .eq('venue_id', venueId);

    console.log('🔍 [API] Delete operation result:', { deleteError });

    if (deleteError) {
      console.error('🔍 [API] Error deleting table:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove table' },
        { status: 500 }
      );
    }

    console.log(`🔍 [API] Table ${table.label} (${tableId}) removed from venue ${venueId}`);

    return NextResponse.json({
      success: true,
      message: `Table "${table.label}" has been removed successfully`,
      removedTable: {
        id: tableId,
        label: table.label
      }
    });

  } catch (error) {
    console.error('Error in remove table API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

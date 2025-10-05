import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { venueId, force = false } = await request.json();

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if venue exists
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    console.log(`🔄 [MANUAL RESET] Starting manual reset for venue: ${venue.name}`);

    // Step 1: Complete all active orders
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from('orders')
      .select('id, order_status, table_number')
      .eq('venue_id', venueId)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

    if (activeOrdersError) {
      console.error('🔄 [MANUAL RESET] Error fetching active orders:', activeOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch active orders' },
        { status: 500 }
      );
    }

    let completedOrders = 0;
    if (activeOrders && activeOrders.length > 0) {
      const { error: completeOrdersError } = await supabase
        .from('orders')
        .update({ 
          order_status: 'COMPLETED',
          updated_at: new Date().toISOString()
        })
        .eq('venue_id', venueId)
        .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

      if (completeOrdersError) {
        console.error('🔄 [MANUAL RESET] Error completing orders:', completeOrdersError);
        return NextResponse.json(
          { error: 'Failed to complete active orders' },
          { status: 500 }
        );
      }
      completedOrders = activeOrders.length;
    }

    // Step 2: Cancel all active reservations
    const { data: activeReservations, error: activeReservationsError } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('venue_id', venueId)
      .eq('status', 'BOOKED');

    if (activeReservationsError) {
      console.error('🔄 [MANUAL RESET] Error fetching active reservations:', activeReservationsError);
      return NextResponse.json(
        { error: 'Failed to fetch active reservations' },
        { status: 500 }
      );
    }

    let canceledReservations = 0;
    if (activeReservations && activeReservations.length > 0) {
      const { error: cancelReservationsError } = await supabase
        .from('reservations')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('venue_id', venueId)
        .eq('status', 'BOOKED');

      if (cancelReservationsError) {
        console.error('🔄 [MANUAL RESET] Error canceling reservations:', cancelReservationsError);
        return NextResponse.json(
          { error: 'Failed to cancel active reservations' },
          { status: 500 }
        );
      }
      canceledReservations = activeReservations.length;
    }

    // Step 3: Delete all tables for complete reset
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label')
      .eq('venue_id', venueId);

    if (tablesError) {
      console.error('🔄 [MANUAL RESET] Error fetching tables:', tablesError);
      return NextResponse.json(
        { error: 'Failed to fetch tables' },
        { status: 500 }
      );
    }

    let deletedTables = 0;
    if (tables && tables.length > 0) {
      // Clear table references from orders first
      const { error: clearTableRefsError } = await supabase
        .from('orders')
        .update({ table_id: null })
        .eq('venue_id', venueId);

      if (clearTableRefsError) {
        console.error('🔄 [MANUAL RESET] Error clearing table references:', clearTableRefsError);
        return NextResponse.json(
          { error: 'Failed to clear table references from orders' },
          { status: 500 }
        );
      }

      // Delete all table sessions first
      const { error: deleteSessionsError } = await supabase
        .from('table_sessions')
        .delete()
        .eq('venue_id', venueId);

      if (deleteSessionsError) {
        console.warn('🔄 [MANUAL RESET] Warning clearing table sessions:', deleteSessionsError);
      }

      // Delete all tables
      const { error: deleteTablesError } = await supabase
        .from('tables')
        .delete()
        .eq('venue_id', venueId);

      if (deleteTablesError) {
        console.error('🔄 [MANUAL RESET] Error deleting tables:', deleteTablesError);
        return NextResponse.json(
          { error: 'Failed to delete tables' },
          { status: 500 }
        );
      }
      deletedTables = tables.length;
    }

    // Step 4: Clear any table runtime state
    const { error: clearRuntimeError } = await supabase
      .from('table_runtime_state')
      .delete()
      .eq('venue_id', venueId);

    if (clearRuntimeError) {
      console.warn('🔄 [MANUAL RESET] Warning clearing runtime state:', clearRuntimeError);
    }

    // Step 5: If force is true, also delete ALL orders for this venue
    if (force) {
      const { error: deleteOrdersError } = await supabase
        .from('orders')
        .delete()
        .eq('venue_id', venueId);

      if (deleteOrdersError) {
        console.error('🔄 [MANUAL RESET] Error deleting all orders:', deleteOrdersError);
        return NextResponse.json(
          { error: 'Failed to delete all orders' },
          { status: 500 }
        );
      }
    }

    console.log(`🔄 [MANUAL RESET] Reset completed for venue: ${venue.name}`);

    return NextResponse.json({
      success: true,
      message: 'Manual reset completed successfully',
      summary: {
        venueId,
        venueName: venue.name,
        completedOrders,
        canceledReservations,
        deletedTables,
        forceMode: force,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🔄 [MANUAL RESET] Error in manual reset:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
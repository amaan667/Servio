import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [DAILY RESET] Daily reset endpoint called');
    
    const { venueId, force = false } = await request.json();
    console.log('🔄 [DAILY RESET] Request data:', { venueId, force });

    if (!venueId) {
      console.log('🔄 [DAILY RESET] Missing venueId');
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    console.log('🔄 [DAILY RESET] Admin Supabase client created');

    // Check if venue exists
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      console.log('🔄 [DAILY RESET] Venue not found:', venueError);
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    console.log('🔄 [DAILY RESET] Starting daily reset for venue:', venue.name);

    // Step 1: Complete all active orders (mark as COMPLETED)
    console.log('🔄 [DAILY RESET] Step 1: Completing all active orders...');
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from('orders')
      .select('id, order_status, table_number')
      .eq('venue_id', venueId)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

    if (activeOrdersError) {
      console.error('🔄 [DAILY RESET] Error fetching active orders:', activeOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch active orders' },
        { status: 500 }
      );
    }

    console.log('🔄 [DAILY RESET] Found active orders:', activeOrders?.length || 0);

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
        console.error('🔄 [DAILY RESET] Error completing orders:', completeOrdersError);
        return NextResponse.json(
          { error: 'Failed to complete active orders' },
          { status: 500 }
        );
      }

      console.log('🔄 [DAILY RESET] Completed', activeOrders.length, 'active orders');
    }

    // Step 2: Cancel all active reservations
    console.log('🔄 [DAILY RESET] Step 2: Canceling all active reservations...');
    const { data: activeReservations, error: activeReservationsError } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('venue_id', venueId)
      .eq('status', 'BOOKED');

    if (activeReservationsError) {
      console.error('🔄 [DAILY RESET] Error fetching active reservations:', activeReservationsError);
      return NextResponse.json(
        { error: 'Failed to fetch active reservations' },
        { status: 500 }
      );
    }

    console.log('🔄 [DAILY RESET] Found active reservations:', activeReservations?.length || 0);

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
        console.error('🔄 [DAILY RESET] Error canceling reservations:', cancelReservationsError);
        return NextResponse.json(
          { error: 'Failed to cancel active reservations' },
          { status: 500 }
        );
      }

      console.log('🔄 [DAILY RESET] Canceled', activeReservations.length, 'active reservations');
    }

    // Step 3: Delete all tables for the venue (complete reset)
    console.log('🔄 [DAILY RESET] Step 3: Deleting all tables for complete reset...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label, session_status')
      .eq('venue_id', venueId);

    if (tablesError) {
      console.error('🔄 [DAILY RESET] Error fetching tables:', tablesError);
      return NextResponse.json(
        { error: 'Failed to fetch tables' },
        { status: 500 }
      );
    }

    console.log('🔄 [DAILY RESET] Found tables to delete:', tables?.length || 0);

    if (tables && tables.length > 0) {
      // Delete all table sessions first (if they exist)
      const { error: deleteSessionsError } = await supabase
        .from('table_sessions')
        .delete()
        .eq('venue_id', venueId);

      if (deleteSessionsError) {
        console.warn('🔄 [DAILY RESET] Warning clearing table sessions:', deleteSessionsError);
        // Don't fail for this, continue
      }

      // Delete all tables for the venue
      const { error: deleteTablesError } = await supabase
        .from('tables')
        .delete()
        .eq('venue_id', venueId);

      if (deleteTablesError) {
        console.error('🔄 [DAILY RESET] Error deleting tables:', deleteTablesError);
        return NextResponse.json(
          { error: 'Failed to delete tables' },
          { status: 500 }
        );
      }

      console.log('🔄 [DAILY RESET] Deleted', tables.length, 'tables completely');
    }

    // Step 4: Clear any table runtime state
    console.log('🔄 [DAILY RESET] Step 4: Clearing table runtime state...');
    const { error: clearRuntimeError } = await supabase
      .from('table_runtime_state')
      .delete()
      .eq('venue_id', venueId);

    if (clearRuntimeError) {
      console.error('🔄 [DAILY RESET] Error clearing runtime state:', clearRuntimeError);
      // Don't fail the entire operation for this
      console.warn('🔄 [DAILY RESET] Continuing despite runtime state clear error');
    } else {
      console.log('🔄 [DAILY RESET] Cleared table runtime state');
    }

    // Step 5: If force is true, also delete ALL orders for this venue
    if (force) {
      console.log('🔄 [DAILY RESET] Step 5: Force mode - deleting ALL orders for venue...');
      
      const { error: deleteOrdersError } = await supabase
        .from('orders')
        .delete()
        .eq('venue_id', venueId);

      if (deleteOrdersError) {
        console.error('🔄 [DAILY RESET] Error deleting all orders:', deleteOrdersError);
        return NextResponse.json(
          { error: 'Failed to delete all orders' },
          { status: 500 }
        );
      }

      console.log('🔄 [DAILY RESET] Deleted ALL orders for venue');
    }

    console.log('🔄 [DAILY RESET] Daily reset completed successfully for venue:', venue.name);

    return NextResponse.json({
      success: true,
      message: 'Daily reset completed successfully',
      summary: {
        venueId,
        venueName: venue.name,
        completedOrders: activeOrders?.length || 0,
        canceledReservations: activeReservations?.length || 0,
        deletedTables: tables?.length || 0,
        forceMode: force,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🔄 [DAILY RESET] Error in daily reset API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if daily reset is needed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check for active orders
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('venue_id', venueId)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

    // Check for active reservations
    const { data: activeReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('venue_id', venueId)
      .eq('status', 'BOOKED');

    // Check for occupied tables
    const { data: occupiedTables, error: tablesError } = await supabase
      .from('tables')
      .select('id')
      .eq('venue_id', venueId)
      .eq('session_status', 'OCCUPIED');

    const needsReset = (activeOrders?.length || 0) > 0 || 
                      (activeReservations?.length || 0) > 0 || 
                      (occupiedTables?.length || 0) > 0;

    return NextResponse.json({
      needsReset,
      summary: {
        activeOrders: activeOrders?.length || 0,
        activeReservations: activeReservations?.length || 0,
        occupiedTables: occupiedTables?.length || 0
      }
    });

  } catch (error) {
    console.error('🔄 [DAILY RESET] Error checking reset status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

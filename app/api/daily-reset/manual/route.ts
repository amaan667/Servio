import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [MANUAL DAILY RESET] Manual daily reset triggered');
    
    const { venueId } = await request.json();
    console.log('🔄 [MANUAL DAILY RESET] Request data:', { venueId });

    if (!venueId) {
      console.log('🔄 [MANUAL DAILY RESET] Missing venueId');
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('🔄 [MANUAL DAILY RESET] SUPABASE_SERVICE_ROLE_KEY not found');
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    console.log('🔄 [MANUAL DAILY RESET] Admin Supabase client created');

    // Check if venue exists
    console.log('🔄 [MANUAL DAILY RESET] Checking if venue exists...');
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .single();

    if (venueError) {
      console.error('🔄 [MANUAL DAILY RESET] Error fetching venue:', venueError);
      return NextResponse.json(
        { error: `Database error: ${venueError.message}` },
        { status: 500 }
      );
    }

    if (!venue) {
      console.log('🔄 [MANUAL DAILY RESET] Venue not found for ID:', venueId);
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    console.log('🔄 [MANUAL DAILY RESET] Starting manual reset for venue:', venue.name);

    // Check if there are any recent orders (within last 2 hours) - if so, warn user
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('venue_id', venueId)
      .gte('created_at', twoHoursAgo)
      .limit(1);

    if (recentOrdersError) {
      console.error('🔄 [MANUAL DAILY RESET] Error checking recent orders:', recentOrdersError);
      // Continue with reset if we can't check
    } else if (recentOrders && recentOrders.length > 0) {
      console.log('🔄 [MANUAL DAILY RESET] Found recent orders, but proceeding with manual reset as requested');
    }

    // Step 1: Complete all active orders (mark as COMPLETED)
    console.log('🔄 [MANUAL DAILY RESET] Step 1: Completing all active orders...');
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from('orders')
      .select('id, order_status, table_number')
      .eq('venue_id', venueId)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

    if (activeOrdersError) {
      console.error('🔄 [MANUAL DAILY RESET] Error fetching active orders:', activeOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch active orders' },
        { status: 500 }
      );
    }

    console.log('🔄 [MANUAL DAILY RESET] Found active orders:', activeOrders?.length || 0);

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
        console.error('🔄 [MANUAL DAILY RESET] Error completing orders:', completeOrdersError);
        return NextResponse.json(
          { error: 'Failed to complete active orders' },
          { status: 500 }
        );
      }

      console.log('🔄 [MANUAL DAILY RESET] Completed', activeOrders.length, 'active orders');
    }

    // Step 2: Cancel all active reservations
    console.log('🔄 [MANUAL DAILY RESET] Step 2: Canceling all active reservations...');
    const { data: activeReservations, error: activeReservationsError } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('venue_id', venueId)
      .eq('status', 'BOOKED');

    if (activeReservationsError) {
      console.error('🔄 [MANUAL DAILY RESET] Error fetching active reservations:', activeReservationsError);
      return NextResponse.json(
        { error: 'Failed to fetch active reservations' },
        { status: 500 }
      );
    }

    console.log('🔄 [MANUAL DAILY RESET] Found active reservations:', activeReservations?.length || 0);

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
        console.error('🔄 [MANUAL DAILY RESET] Error canceling reservations:', cancelReservationsError);
        return NextResponse.json(
          { error: 'Failed to cancel active reservations' },
          { status: 500 }
        );
      }

      console.log('🔄 [MANUAL DAILY RESET] Canceled', activeReservations.length, 'active reservations');
    }

    // Step 3: Delete all tables for complete reset
    console.log('🔄 [MANUAL DAILY RESET] Step 3: Deleting all tables for complete reset...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label')
      .eq('venue_id', venueId);

    if (tablesError) {
      console.error('🔄 [MANUAL DAILY RESET] Error fetching tables:', tablesError);
      return NextResponse.json(
        { error: 'Failed to fetch tables' },
        { status: 500 }
      );
    }

    console.log('🔄 [MANUAL DAILY RESET] Found tables to delete:', tables?.length || 0);

    if (tables && tables.length > 0) {
      // Delete all table sessions first (if they exist)
      const { error: deleteSessionsError } = await supabase
        .from('table_sessions')
        .delete()
        .eq('venue_id', venueId);

      if (deleteSessionsError) {
        console.warn('🔄 [MANUAL DAILY RESET] Warning clearing table sessions:', deleteSessionsError);
        // Don't fail for this, continue
      }

      // Delete all tables for the venue
      const { error: deleteTablesError } = await supabase
        .from('tables')
        .delete()
        .eq('venue_id', venueId);

      if (deleteTablesError) {
        console.error('🔄 [MANUAL DAILY RESET] Error deleting tables:', deleteTablesError);
        return NextResponse.json(
          { error: 'Failed to delete tables' },
          { status: 500 }
        );
      }

      console.log('🔄 [MANUAL DAILY RESET] Deleted', tables.length, 'tables completely');
    }

    // Step 4: Clear any table runtime state
    console.log('🔄 [MANUAL DAILY RESET] Step 4: Clearing table runtime state...');
    const { error: clearRuntimeError } = await supabase
      .from('table_runtime_state')
      .delete()
      .eq('venue_id', venueId);

    if (clearRuntimeError) {
      console.error('🔄 [MANUAL DAILY RESET] Error clearing runtime state:', clearRuntimeError);
      // Don't fail the entire operation for this
      console.warn('🔄 [MANUAL DAILY RESET] Continuing despite runtime state clear error');
    } else {
      console.log('🔄 [MANUAL DAILY RESET] Cleared table runtime state');
    }

    // Step 5: Record the manual reset in the log (but don't prevent future resets)
    console.log('🔄 [MANUAL DAILY RESET] Step 5: Recording manual reset in log...');
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { error: logError } = await supabase
      .from('daily_reset_log')
      .upsert({
        venue_id: venueId,
        reset_date: todayString,
        reset_timestamp: new Date().toISOString(),
        completed_orders: activeOrders?.length || 0,
        canceled_reservations: activeReservations?.length || 0,
        reset_tables: tables?.length || 0
      }, {
        onConflict: 'venue_id,reset_date'
      });

    if (logError) {
      console.error('🔄 [MANUAL DAILY RESET] Error logging reset:', logError);
      // Don't fail the operation for this
      console.warn('🔄 [MANUAL DAILY RESET] Continuing despite log error');
    } else {
      console.log('🔄 [MANUAL DAILY RESET] Manual reset logged successfully');
    }

    console.log('🔄 [MANUAL DAILY RESET] Manual reset completed successfully for venue:', venue.name);

    return NextResponse.json({
      success: true,
      message: 'Manual daily reset completed successfully',
      summary: {
        venueId,
        venueName: venue.name,
        completedOrders: activeOrders?.length || 0,
        canceledReservations: activeReservations?.length || 0,
        deletedTables: tables?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🔄 [MANUAL DAILY RESET] Error in manual daily reset:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

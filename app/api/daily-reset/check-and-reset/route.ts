import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [DAILY RESET CHECK] Checking if daily reset is needed');
    
    const { venueId } = await request.json();
    console.log('🔄 [DAILY RESET CHECK] Request data:', { venueId });

    if (!venueId) {
      console.log('🔄 [DAILY RESET CHECK] Missing venueId');
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('🔄 [DAILY RESET CHECK] SUPABASE_SERVICE_ROLE_KEY not found');
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    console.log('🔄 [DAILY RESET CHECK] Admin Supabase client created');

    // Check if venue exists
    console.log('🔄 [DAILY RESET CHECK] Checking if venue exists...');
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .single();

    if (venueError) {
      console.error('🔄 [DAILY RESET CHECK] Error fetching venue:', venueError);
      return NextResponse.json(
        { error: `Database error: ${venueError.message}` },
        { status: 500 }
      );
    }

    if (!venue) {
      console.log('🔄 [DAILY RESET CHECK] Venue not found for ID:', venueId);
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    // Check if we need to reset based on date
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Try to create the daily_reset_log table if it doesn't exist
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS daily_reset_log (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            venue_id TEXT NOT NULL,
            reset_date DATE NOT NULL,
            reset_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_orders INTEGER DEFAULT 0,
            canceled_reservations INTEGER DEFAULT 0,
            reset_tables INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(venue_id, reset_date)
          );
        `
      });
    } catch (error) {
      console.log('🔧 [DAILY RESET CHECK] Table creation skipped (may already exist):', error);
    }
    
    // Check if there's a reset record for today
    const { data: resetRecord, error: resetError } = await supabase
      .from('daily_reset_log')
      .select('*')
      .eq('venue_id', venueId)
      .eq('reset_date', todayString)
      .maybeSingle();

    if (resetError) {
      console.log('🔄 [DAILY RESET CHECK] Error checking reset record:', resetError);
      // Continue anyway - don't fail if table doesn't exist
    }

    // If we already reset today, return success
    if (resetRecord) {
      console.log('🔄 [DAILY RESET CHECK] Already reset today:', todayString);
      return NextResponse.json({
        success: true,
        message: 'Already reset today',
        resetDate: todayString,
        alreadyReset: true
      });
    }

    console.log('🔄 [DAILY RESET CHECK] Daily reset needed for venue:', venue.name);

    // Perform the reset
    let resetSummary = {
      completedOrders: 0,
      canceledReservations: 0,
      resetTables: 0
    };

    // Step 1: Complete all active orders
    console.log('🔄 [DAILY RESET CHECK] Step 1: Completing all active orders...');
    const { data: activeOrders, error: activeOrdersError } = await supabase
      .from('orders')
      .select('id, order_status, table_number')
      .eq('venue_id', venueId)
      .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

    if (activeOrdersError) {
      console.error('🔄 [DAILY RESET CHECK] Error fetching active orders:', activeOrdersError);
      return NextResponse.json(
        { error: 'Failed to fetch active orders' },
        { status: 500 }
      );
    }

    console.log('🔄 [DAILY RESET CHECK] Found active orders:', activeOrders?.length || 0);

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
        console.error('🔄 [DAILY RESET CHECK] Error completing orders:', completeOrdersError);
        return NextResponse.json(
          { error: 'Failed to complete active orders' },
          { status: 500 }
        );
      }

      resetSummary.completedOrders = activeOrders.length;
      console.log('🔄 [DAILY RESET CHECK] Completed', activeOrders.length, 'active orders');
    }

    // Step 2: Cancel all active reservations
    console.log('🔄 [DAILY RESET CHECK] Step 2: Canceling all active reservations...');
    const { data: activeReservations, error: activeReservationsError } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('venue_id', venueId)
      .eq('status', 'BOOKED');

    if (activeReservationsError) {
      console.error('🔄 [DAILY RESET CHECK] Error fetching active reservations:', activeReservationsError);
      return NextResponse.json(
        { error: 'Failed to fetch active reservations' },
        { status: 500 }
      );
    }

    console.log('🔄 [DAILY RESET CHECK] Found active reservations:', activeReservations?.length || 0);

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
        console.error('🔄 [DAILY RESET CHECK] Error canceling reservations:', cancelReservationsError);
        return NextResponse.json(
          { error: 'Failed to cancel active reservations' },
          { status: 500 }
        );
      }

      resetSummary.canceledReservations = activeReservations.length;
      console.log('🔄 [DAILY RESET CHECK] Canceled', activeReservations.length, 'active reservations');
    }

    // Step 3: Delete all tables for complete reset
    console.log('🔄 [DAILY RESET CHECK] Step 3: Deleting all tables for complete reset...');
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, label')
      .eq('venue_id', venueId);

    if (tablesError) {
      console.error('🔄 [DAILY RESET CHECK] Error fetching tables:', tablesError);
      return NextResponse.json(
        { error: 'Failed to fetch tables' },
        { status: 500 }
      );
    }

    console.log('🔄 [DAILY RESET CHECK] Found tables to delete:', tables?.length || 0);

    if (tables && tables.length > 0) {
      // Delete all table sessions first (if they exist)
      const { error: deleteSessionsError } = await supabase
        .from('table_sessions')
        .delete()
        .eq('venue_id', venueId);

      if (deleteSessionsError) {
        console.warn('🔄 [DAILY RESET CHECK] Warning clearing table sessions:', deleteSessionsError);
        // Don't fail for this, continue
      }

      // Delete all tables for the venue
      const { error: deleteTablesError } = await supabase
        .from('tables')
        .delete()
        .eq('venue_id', venueId);

      if (deleteTablesError) {
        console.error('🔄 [DAILY RESET CHECK] Error deleting tables:', deleteTablesError);
        return NextResponse.json(
          { error: 'Failed to delete tables' },
          { status: 500 }
        );
      }

      resetSummary.resetTables = tables.length;
      console.log('🔄 [DAILY RESET CHECK] Deleted', tables.length, 'tables completely');
    }

    // Step 4: Clear any table runtime state
    console.log('🔄 [DAILY RESET CHECK] Step 4: Clearing table runtime state...');
    const { error: clearRuntimeError } = await supabase
      .from('table_runtime_state')
      .delete()
      .eq('venue_id', venueId);

    if (clearRuntimeError) {
      console.error('🔄 [DAILY RESET CHECK] Error clearing runtime state:', clearRuntimeError);
      // Don't fail the entire operation for this
      console.warn('🔄 [DAILY RESET CHECK] Continuing despite runtime state clear error');
    } else {
      console.log('🔄 [DAILY RESET CHECK] Cleared table runtime state');
    }

    // Step 5: Record the reset in the log
    console.log('🔄 [DAILY RESET CHECK] Step 5: Recording reset in log...');
    const { error: logError } = await supabase
      .from('daily_reset_log')
      .insert({
        venue_id: venueId,
        reset_date: todayString,
        reset_timestamp: new Date().toISOString(),
        completed_orders: resetSummary.completedOrders,
        canceled_reservations: resetSummary.canceledReservations,
        reset_tables: resetSummary.resetTables
      });

    if (logError) {
      console.error('🔄 [DAILY RESET CHECK] Error logging reset:', logError);
      // Don't fail the operation for this
      console.warn('🔄 [DAILY RESET CHECK] Continuing despite log error');
    } else {
      console.log('🔄 [DAILY RESET CHECK] Reset logged successfully');
    }

    console.log('🔄 [DAILY RESET CHECK] Daily reset completed successfully for venue:', venue.name);

    return NextResponse.json({
      success: true,
      message: 'Daily reset completed successfully',
      resetDate: todayString,
      summary: {
        venueId,
        venueName: venue.name,
        completedOrders: resetSummary.completedOrders,
        canceledReservations: resetSummary.canceledReservations,
        deletedTables: resetSummary.resetTables,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🔄 [DAILY RESET CHECK] Error in daily reset check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

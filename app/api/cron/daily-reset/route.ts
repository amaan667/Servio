import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// This endpoint can be called by a cron job or scheduled task
// to automatically perform daily reset at midnight
export async function POST(request: NextRequest) {
  try {
    
    // Verify this is a legitimate cron request (you can add authentication here)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.CRON_SECRET || 'default-cron-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if it's time for any venue's daily reset
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    

    const supabase = createAdminClient();
    
    // Get all venues that need daily reset at the current time (within 5 minutes)
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('venue_id, venue_name, daily_reset_time')
      .not('daily_reset_time', 'is', null);

    if (venuesError) {
      logger.error('🕛 [CRON DAILY RESET] Error fetching venues:', venuesError);
      return NextResponse.json(
        { error: 'Failed to fetch venues' },
        { status: 500 }
      );
    }

    if (!venues || venues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No venues found for daily reset',
        resetVenues: []
      });
    }

    // Filter venues that should reset at the current time (within 5 minutes)
    const venuesToReset = venues.filter(venue => {
      if (!venue.daily_reset_time) return false;
      
      const [resetHour, resetMinute] = venue.daily_reset_time.split(':').map(Number);
      const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (resetHour * 60 + resetMinute));
      
      // Reset if within 5 minutes of the scheduled time
      return timeDiff <= 5;
    });

    if (venuesToReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No venues scheduled for reset at this time',
        currentTime,
        resetVenues: []
      });
    }


    const resetResults = [];

    for (const venue of venuesToReset) {
      try {

        // Check if this venue needs reset
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('venue_id', venue.venue_id)
          .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);

        const { data: activeReservations } = await supabase
          .from('reservations')
          .select('id')
          .eq('venue_id', venue.venue_id)
          .eq('status', 'BOOKED');

        // Check for occupied tables by looking at table_sessions instead
        const { data: occupiedTables } = await supabase
          .from('table_sessions')
          .select('table_id')
          .eq('venue_id', venue.venue_id)
          .eq('status', 'ACTIVE');

        const needsReset = (activeOrders?.length || 0) > 0 || 
                          (activeReservations?.length || 0) > 0 || 
                          (occupiedTables?.length || 0) > 0;

        if (!needsReset) {
          resetResults.push({
            venueId: venue.venue_id,
            venueName: venue.venue_name,
            reset: false,
            reason: 'No active orders, reservations, or occupied tables'
          });
          continue;
        }

        // Perform the reset

        // Complete all active orders
        if (activeOrders && activeOrders.length > 0) {
          await supabase
            .from('orders')
            .update({ 
              order_status: 'COMPLETED',
              updated_at: new Date().toISOString()
            })
            .eq('venue_id', venue.venue_id)
            .in('order_status', ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING']);
        }

        // Cancel all active reservations
        if (activeReservations && activeReservations.length > 0) {
          await supabase
            .from('reservations')
            .update({ 
              status: 'CANCELLED',
              updated_at: new Date().toISOString()
            })
            .eq('venue_id', venue.venue_id)
            .eq('status', 'BOOKED');
        }

        // Delete all tables for complete reset
        const { data: venueTables } = await supabase
          .from('tables')
          .select('id')
          .eq('venue_id', venue.venue_id);

        if (venueTables && venueTables.length > 0) {
          // Delete all table sessions first
          await supabase
            .from('table_sessions')
            .delete()
            .eq('venue_id', venue.venue_id);

          // Delete all tables
          await supabase
            .from('tables')
            .delete()
            .eq('venue_id', venue.venue_id);
        }

        // Clear table runtime state
        await supabase
          .from('table_runtime_state')
          .delete()
          .eq('venue_id', venue.venue_id);

        resetResults.push({
          venueId: venue.venue_id,
          venueName: venue.venue_name,
          reset: true,
          completedOrders: activeOrders?.length || 0,
          canceledReservations: activeReservations?.length || 0,
          deletedTables: venueTables?.length || 0
        });


      } catch (error) {
        logger.error(`🕛 [CRON DAILY RESET] Error resetting venue ${venue.venue_name}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
        resetResults.push({
          venueId: venue.venue_id,
          venueName: venue.venue_name,
          reset: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successfulResets = resetResults.filter(r => r.reset).length;
    const totalVenues = venuesToReset.length;


    return NextResponse.json({
      success: true,
      message: `Daily reset completed for ${successfulResets}/${totalVenues} venues`,
      timestamp: new Date().toISOString(),
      resetResults
    });

  } catch (error) {
    logger.error('🕛 [CRON DAILY RESET] Error in automatic daily reset:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check cron status
export async function GET() {
  return NextResponse.json({
    message: 'Daily reset cron endpoint is active',
    timestamp: new Date().toISOString(),
    nextReset: 'Scheduled for midnight daily'
  });
}

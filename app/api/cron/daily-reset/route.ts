import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// This endpoint can be called by a cron job or scheduled task
// to automatically perform daily reset at midnight
export async function POST(request: NextRequest) {
  try {
    console.log('🕛 [CRON DAILY RESET] Automatic daily reset triggered');
    
    // Verify this is a legitimate cron request (you can add authentication here)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.CRON_SECRET || 'default-cron-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      console.log('🕛 [CRON DAILY RESET] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if it's actually midnight (within 5 minutes of 00:00)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Only run if it's between 00:00 and 00:05
    if (currentHour !== 0 || currentMinute > 5) {
      console.log('🕛 [CRON DAILY RESET] Not midnight, skipping reset', { currentHour, currentMinute });
      return NextResponse.json({
        success: true,
        message: 'Not midnight, skipping reset',
        currentTime: now.toISOString()
      });
    }

    const supabase = await createServerSupabase();
    
    // Get all venues that need daily reset
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('venue_id, name');

    if (venuesError) {
      console.error('🕛 [CRON DAILY RESET] Error fetching venues:', venuesError);
      return NextResponse.json(
        { error: 'Failed to fetch venues' },
        { status: 500 }
      );
    }

    if (!venues || venues.length === 0) {
      console.log('🕛 [CRON DAILY RESET] No venues found');
      return NextResponse.json({
        success: true,
        message: 'No venues found for daily reset',
        resetVenues: []
      });
    }

    const resetResults = [];

    for (const venue of venues) {
      try {
        console.log(`🕛 [CRON DAILY RESET] Processing venue: ${venue.name} (${venue.venue_id})`);

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

        const { data: occupiedTables } = await supabase
          .from('tables')
          .select('id')
          .eq('venue_id', venue.venue_id)
          .eq('session_status', 'OCCUPIED');

        const needsReset = (activeOrders?.length || 0) > 0 || 
                          (activeReservations?.length || 0) > 0 || 
                          (occupiedTables?.length || 0) > 0;

        if (!needsReset) {
          console.log(`🕛 [CRON DAILY RESET] Venue ${venue.name} doesn't need reset`);
          resetResults.push({
            venueId: venue.venue_id,
            venueName: venue.name,
            reset: false,
            reason: 'No active orders, reservations, or occupied tables'
          });
          continue;
        }

        // Perform the reset
        console.log(`🕛 [CRON DAILY RESET] Resetting venue: ${venue.name}`);

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

        // Reset all tables to FREE
        await supabase
          .from('tables')
          .update({ 
            session_status: 'FREE',
            order_id: null,
            opened_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('venue_id', venue.venue_id);

        // Clear table runtime state
        await supabase
          .from('table_runtime_state')
          .delete()
          .eq('venue_id', venue.venue_id);

        resetResults.push({
          venueId: venue.venue_id,
          venueName: venue.name,
          reset: true,
          completedOrders: activeOrders?.length || 0,
          canceledReservations: activeReservations?.length || 0,
          resetTables: occupiedTables?.length || 0
        });

        console.log(`🕛 [CRON DAILY RESET] Successfully reset venue: ${venue.name}`);

      } catch (error) {
        console.error(`🕛 [CRON DAILY RESET] Error resetting venue ${venue.name}:`, error);
        resetResults.push({
          venueId: venue.venue_id,
          venueName: venue.name,
          reset: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successfulResets = resetResults.filter(r => r.reset).length;
    const totalVenues = venues.length;

    console.log(`🕛 [CRON DAILY RESET] Daily reset completed: ${successfulResets}/${totalVenues} venues reset`);

    return NextResponse.json({
      success: true,
      message: `Daily reset completed for ${successfulResets}/${totalVenues} venues`,
      timestamp: new Date().toISOString(),
      resetResults
    });

  } catch (error) {
    console.error('🕛 [CRON DAILY RESET] Error in automatic daily reset:', error);
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

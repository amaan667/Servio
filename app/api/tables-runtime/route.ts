import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venue_id');

    if (!venueId) {
      return NextResponse.json(
        { error: 'venue_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get table runtime state
    const { data: tables, error: tablesError } = await supabase
      .from('table_runtime_state')
      .select('*')
      .eq('venue_id', venueId)
      .order('label');

    if (tablesError) {
      logger.error('Error fetching table runtime state:', tablesError);
      return NextResponse.json(
        { error: 'Failed to fetch tables' },
        { status: 500 }
      );
    }

    // Get table counters
    const { data: counters, error: countersError } = await supabase
      .rpc('api_table_counters', { p_venue_id: venueId });

    if (countersError) {
      logger.error('Error fetching table counters:', countersError);
      return NextResponse.json(
        { error: 'Failed to fetch counters' },
        { status: 500 }
      );
    }

    // Get unassigned reservations
    const { data: unassignedReservations, error: reservationsError } = await supabase
      .from('unassigned_reservations')
      .select('*')
      .eq('venue_id', venueId);

    if (reservationsError) {
      logger.error('Error fetching unassigned reservations:', reservationsError);
      return NextResponse.json(
        { error: 'Failed to fetch reservations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tables: tables || [],
      counters: counters?.[0] || {
        total_tables: 0,
        available: 0,
        occupied: 0,
        reserved_now: 0,
        reserved_later: 0,
        unassigned_reservations: 0
      },
      unassignedReservations: unassignedReservations || []
    });

  } catch (_error) {
    logger.error('Error in tables-runtime API:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

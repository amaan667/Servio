import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }


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
    logger.error('Error in tables-runtime API:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

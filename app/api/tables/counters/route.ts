import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// GET /api/tables/counters?venueId=xxx - Get table counters for dashboard
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }
    
    // Use admin client - no auth needed (venueId is sufficient)
    const supabase = createAdminClient();

    // Call the database function to get counters
    const { data: counters, error } = await supabase.rpc('api_table_counters', {
      p_venue_id: venueId
    });

    if (error) {
      logger.error('[TABLES COUNTERS] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // The function returns a single row with all counters
    const counter = counters?.[0] || {
      total_tables: 0,
      available: 0,
      occupied: 0,
      reserved_now: 0,
      reserved_later: 0,
      block_window_mins: 0
    };

    // Also get real-time counts for verification
    const { data: realtimeCounts, error: realtimeError } = await supabase.rpc('get_realtime_table_counts', {
      p_venue_id: venueId
    });

    if (realtimeError) {
      logger.error('[TABLES COUNTERS] Realtime error:', realtimeError);
    } else {
      // Intentionally empty
    }

    return NextResponse.json({
      ok: true,
      counters: {
        total_tables: Number(counter.total_tables),
        available: Number(counter.available),
        occupied: Number(counter.occupied),
        reserved_now: Number(counter.reserved_now),
        reserved_later: Number(counter.reserved_later),
        block_window_mins: Number(counter.block_window_mins)
      }
    });

  } catch (_error) {
    logger.error('[TABLES COUNTERS] Unexpected error:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/tables/counters?venueId=xxx - Get table counters for dashboard
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Call the database function to get counters
    const { data: counters, error } = await supabase.rpc('api_table_counters', {
      p_venue_id: venueId
    });

    if (error) {
      console.error('[TABLES COUNTERS] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // The function returns a single row with all counters
    const counter = counters?.[0] || {
      tables_set_up: 0,
      in_use_now: 0,
      reserved_now: 0,
      reserved_later: 0,
      waiting: 0
    };

    return NextResponse.json({
      ok: true,
      counters: {
        tables_set_up: Number(counter.tables_set_up),
        in_use_now: Number(counter.in_use_now),
        reserved_now: Number(counter.reserved_now),
        reserved_later: Number(counter.reserved_later),
        waiting: Number(counter.waiting)
      }
    });

  } catch (error) {
    console.error('[TABLES COUNTERS] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

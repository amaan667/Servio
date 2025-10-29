import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// GET /api/reservations/unassigned?venueId=xxx - Get unassigned reservations
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
    }
    
    // Use admin client - no auth needed (venueId is sufficient)
    const supabase = createAdminClient();

    // Get unassigned reservations using the view
    const { data: reservations, error } = await supabase
      .from('unassigned_reservations')
      .select('*')
      .eq('venue_id', venueId)
      .order('start_at', { ascending: true });

    if (error) {
      logger.error('[RESERVATIONS UNASSIGNED] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reservations: reservations || []
    });

  } catch (_error) {
    logger.error('[RESERVATIONS UNASSIGNED] Unexpected error:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

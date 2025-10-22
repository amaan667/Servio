import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/supabase';
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

  } catch (error) {
    logger.error('[RESERVATIONS UNASSIGNED] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;

    if (!tableId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'tableId is required' 
      }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const supabase = await createClient();

    // Get the reservation for this table
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('table_id', tableId)
      .in('status', ['BOOKED', 'CHECKED_IN'])
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      logger.error('[GET RESERVATION BY TABLE] Error fetching reservation:', reservationError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to fetch reservation' 
      }, { status: 500 });
    }

    // Check venue ownership if reservation exists
    if (reservation) {
      const { data: venue } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('venue_id', reservation.venue_id)
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (!venue) {
        return NextResponse.json({ 
          ok: false, 
          error: 'Forbidden' 
        }, { status: 403 });
      }
    }

    return NextResponse.json({
      ok: true,
      reservation: reservation || null
    });

  } catch (error: unknown) {
    logger.error('[GET RESERVATION BY TABLE] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}


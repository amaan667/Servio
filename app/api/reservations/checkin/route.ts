import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { reservationId, tableId } = await req.json();

    if (!reservationId || !tableId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'reservationId and tableId are required' 
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

    // Check venue ownership through the reservation
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('venue_id')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Reservation not found' 
      }, { status: 404 });
    }

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

    // Update reservation status to CHECKED_IN
    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update({ 
        status: 'CHECKED_IN',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId)
      .select()
      .single();

    if (updateError) {
      logger.error('[CHECKIN] Error updating reservation:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to check in reservation' 
      }, { status: 500 });
    }

    // Also update the table session to OCCUPIED if it's not already
    const { error: tableError } = await supabase
      .from('table_sessions')
      .upsert({
        table_id: tableId,
        status: 'OCCUPIED',
        opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'table_id'
      });

    if (tableError) {
      logger.error('[CHECKIN] Error updating table session:', { error: tableError instanceof Error ? tableError.message : 'Unknown error' });
      // Don't fail the request, just log the error
    }


    return NextResponse.json({
      ok: true,
      reservation: updatedReservation
    });

  } catch (error: any) {
    logger.error('[CHECKIN] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

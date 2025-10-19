import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest, context: { params: Promise<{ reservationId: string }> }) {
  try {
    const { reservationId } = await context.params;
    const { customerName, startAt, endAt, partySize, customerPhone } = await req.json();

    if (!reservationId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'reservationId is required' 
      }, { status: 400 });
    }

    if (!customerName || !startAt || !endAt || !partySize) {
      return NextResponse.json({ 
        ok: false, 
        error: 'customerName, startAt, endAt, and partySize are required' 
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

    // Update the reservation
    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update({ 
        customer_name: customerName,
        start_at: startAt,
        end_at: endAt,
        party_size: partySize,
        customer_phone: customerPhone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId)
      .select()
      .single();

    if (updateError) {
      logger.error('[MODIFY RESERVATION] Error updating reservation:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to modify reservation' 
      }, { status: 500 });
    }


    return NextResponse.json({
      ok: true,
      reservation: updatedReservation
    });

  } catch (error: any) {
    logger.error('[MODIFY RESERVATION] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

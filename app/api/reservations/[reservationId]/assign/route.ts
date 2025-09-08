import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/reservations/[reservationId]/assign - Assign reservation to table
export async function POST(
  req: Request,
  context: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await context.params;
    const body = await req.json();
    const { tableId } = body;

    if (!reservationId || !tableId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'reservationId and tableId are required' 
      }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();

    // Get reservation info to check venue ownership
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('venue_id')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json({ ok: false, error: 'Reservation not found' }, { status: 404 });
    }

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', reservation.venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Call the database function to assign reservation
    const { error } = await supabase.rpc('api_assign_reservation', {
      p_reservation_id: reservationId,
      p_table_id: tableId
    });

    if (error) {
      console.error('[RESERVATIONS ASSIGN] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Reservation assigned successfully'
    });

  } catch (error) {
    console.error('[RESERVATIONS ASSIGN] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
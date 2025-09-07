import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/reservations?venueId=xxx - Get reservations for a venue
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    const status = searchParams.get('status') || 'all';

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

    // Build query
    let query = supabase
      .from('reservations')
      .select(`
        id,
        venue_id,
        table_id,
        customer_name,
        customer_phone,
        start_at,
        end_at,
        party_size,
        status,
        created_at,
        updated_at,
        tables!inner(label)
      `)
      .eq('venue_id', venueId)
      .order('start_at', { ascending: true });

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: reservations, error } = await query;

    if (error) {
      console.error('[RESERVATIONS GET] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reservations: reservations || []
    });

  } catch (error) {
    console.error('[RESERVATIONS GET] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/reservations - Create a new reservation
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      venueId, 
      tableId, 
      customerName, 
      customerPhone, 
      startAt, 
      endAt, 
      partySize 
    } = body;

    if (!venueId || !customerName || !startAt || !endAt) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId, customerName, startAt, and endAt are required' 
      }, { status: 400 });
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

    // Create reservation
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        venue_id: venueId,
        table_id: tableId || null, // Can be null for unassigned reservations
        customer_name: customerName,
        customer_phone: customerPhone || null,
        start_at: startAt,
        end_at: endAt,
        party_size: partySize || 2,
        status: 'BOOKED'
      })
      .select()
      .single();

    if (error) {
      console.error('[RESERVATIONS POST] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reservation: reservation
    });

  } catch (error) {
    console.error('[RESERVATIONS POST] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

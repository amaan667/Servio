import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// GET - Fetch KDS tickets for a venue or station
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    const stationId = searchParams.get('stationId');
    const status = searchParams.get('status'); // Optional filter

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    
    // Verify user has access to this venue
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build query
    let query = supabase
      .from('kds_tickets')
      .select(`
        *,
        kds_stations (
          id,
          station_name,
          station_type,
          color_code
        ),
        orders (
          id,
          customer_name,
          order_status,
          payment_status
        )
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: true });

    // Filter by station if provided
    if (stationId) {
      query = query.eq('station_id', stationId);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    } else {
      // By default, exclude bumped tickets (they're done)
      query = query.neq('status', 'bumped');
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error('[KDS] Error fetching tickets:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tickets: tickets || []
    });
  } catch (error: any) {
    console.error('[KDS] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update ticket status
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, status } = body;

    if (!ticketId || !status) {
      return NextResponse.json(
        { ok: false, error: 'ticketId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['new', 'in_progress', 'ready', 'bumped'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    
    // Verify user has access
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build update object with timestamp
    const updateData: any = { status };
    const now = new Date().toISOString();

    switch (status) {
      case 'in_progress':
        updateData.started_at = now;
        break;
      case 'ready':
        updateData.ready_at = now;
        break;
      case 'bumped':
        updateData.bumped_at = now;
        break;
    }

    const { data: ticket, error } = await supabase
      .from('kds_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select(`
        *,
        kds_stations (
          id,
          station_name,
          station_type,
          color_code
        ),
        orders (
          id,
          customer_name,
          order_status
        )
      `)
      .single();

    if (error) {
      console.error('[KDS] Error updating ticket:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      ticket
    });
  } catch (error: any) {
    console.error('[KDS] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


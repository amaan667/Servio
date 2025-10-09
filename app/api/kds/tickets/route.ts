import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Function to automatically backfill missing KDS tickets for orders
async function autoBackfillMissingTickets(venueId: string) {
  try {
    console.log('[KDS AUTO-BACKFILL] Checking for orders without KDS tickets...');
    
    // Get today's orders that should have KDS tickets but don't
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: ordersWithoutTickets } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('venue_id', venueId)
      .in('payment_status', ['PAID', 'UNPAID'])
      .in('order_status', ['PLACED', 'IN_PREP', 'READY'])
      .gte('created_at', todayStart.toISOString())
      .not('id', 'in', `(SELECT DISTINCT order_id FROM kds_tickets WHERE venue_id = '${venueId}')`);

    if (!ordersWithoutTickets || ordersWithoutTickets.length === 0) {
      console.log('[KDS AUTO-BACKFILL] No orders found without KDS tickets');
      return;
    }

    console.log(`[KDS AUTO-BACKFILL] Found ${ordersWithoutTickets.length} orders without KDS tickets, creating tickets...`);

    // Get expo station for this venue
    const { data: expoStation } = await supabaseAdmin
      .from('kds_stations')
      .select('id')
      .eq('venue_id', venueId)
      .eq('station_type', 'expo')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!expoStation) {
      console.log('[KDS AUTO-BACKFILL] No expo station found, skipping backfill');
      return;
    }

    // Create tickets for orders without them
    for (const orderRef of ordersWithoutTickets) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, venue_id, table_number, table_id, items')
        .eq('id', orderRef.id)
        .single();

      if (!order || !Array.isArray(order.items)) continue;

      // Create tickets for each item
      for (const item of order.items) {
        const ticketData = {
          venue_id: order.venue_id,
          order_id: order.id,
          station_id: expoStation.id,
          item_name: item.item_name || 'Unknown Item',
          quantity: parseInt(item.quantity) || 1,
          special_instructions: item.specialInstructions || null,
          table_number: order.table_number,
          table_label: order.table_id || order.table_number?.toString() || 'Unknown',
          status: 'new'
        };

        await supabaseAdmin
          .from('kds_tickets')
          .insert(ticketData);
      }

      console.log(`[KDS AUTO-BACKFILL] Created tickets for order ${order.id}`);
    }

    console.log(`[KDS AUTO-BACKFILL] Auto-backfill completed for ${ordersWithoutTickets.length} orders`);

  } catch (error) {
    console.error('[KDS AUTO-BACKFILL] Error during auto-backfill:', error);
    throw error;
  }
}

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

    // Auto-backfill: Check if we have orders without KDS tickets and create them
    try {
      await autoBackfillMissingTickets(venueId);
    } catch (backfillError) {
      console.warn('[KDS] Auto-backfill failed (non-critical):', backfillError);
      // Don't fail the request if backfill fails
    }

    // Fetch tickets again after potential backfill
    const { data: finalTickets, error: finalError } = await query;

    if (finalError) {
      console.error('[KDS] Error fetching tickets after backfill:', finalError);
      return NextResponse.json(
        { ok: false, error: finalError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tickets: finalTickets || []
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


import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// PATCH - Bulk update multiple tickets (e.g., bump all ready tickets for an order)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { orderId, stationId, status } = body;

    if (!status) {
      return NextResponse.json(
        { ok: false, error: 'status is required' },
        { status: 400 }
      );
    }

    if (!orderId && !stationId) {
      return NextResponse.json(
        { ok: false, error: 'Either orderId or stationId is required' },
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

    // Build query based on what was provided
    let query = supabase
      .from('kds_tickets')
      .update(updateData);

    if (orderId) {
      query = query.eq('order_id', orderId);
    }
    if (stationId) {
      query = query.eq('station_id', stationId);
    }

    const { data: tickets, error } = await query.select();

    if (error) {
      console.error('[KDS] Error bulk updating tickets:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated: tickets?.length || 0,
      tickets
    });
  } catch (error: any) {
    console.error('[KDS] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');
    const isActive = searchParams.get('is_active') === 'true';
    const status = searchParams.get('status');
    const station = searchParams.get('station');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        tables!left (
          id,
          label,
          area
        )
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (isActive) {
      query = query.eq('is_active', true);
    }

    if (status) {
      query = query.eq('order_status', status);
    }

    if (station) {
      // Filter by items that have the specified station
      query = query.contains('items', [{ station }]);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('[POS ORDERS] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform orders to include table_label
    const transformedOrders = orders?.map(order => ({
      ...order,
      table_label: order.tables?.label || `Table ${order.table_number}`
    })) || [];

    return NextResponse.json({ orders: transformedOrders });
  } catch (error) {
    console.error('[POS ORDERS] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

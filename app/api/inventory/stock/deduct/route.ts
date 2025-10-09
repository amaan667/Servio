import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/inventory/stock/deduct
// Deducts stock for an order using the SQL function
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { order_id, venue_id } = body;

    if (!order_id || !venue_id) {
      return NextResponse.json(
        { error: 'order_id and venue_id are required' },
        { status: 400 }
      );
    }

    // Call the SQL function to deduct stock
    const { data, error } = await supabase.rpc('deduct_stock_for_order', {
      p_order_id: order_id,
      p_venue_id: venue_id,
    });

    if (error) {
      console.error('[INVENTORY API] Error deducting stock:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[INVENTORY API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        venue_id: body.venue_id,
        table_number: body.table_number,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        status: 'pending',
        total_amount: body.total_amount,
        notes: body.notes,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Order insert failed' }, { status: 400 });
    }

    // Create order items
    const orderItems = (body.items || []).map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      item_name: item.item_name,
    }));

    if (orderItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}



export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Missing service role key' }, { status: 500 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Basic validation
    if (!body?.venue_id || !Array.isArray(body?.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Invalid order payload' }, { status: 400 });
    }

    // Create order
    const { data: order, error: orderError } = await admin
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
    const orderItems = body.items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      item_name: item.item_name,
    }));

    if (orderItems.length > 0) {
      const { error: itemsError } = await admin
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



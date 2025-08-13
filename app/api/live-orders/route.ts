// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type OrderItemIn = {
  menu_item_id: string | null;             // can be null (ad-hoc/demo item)
  item_name: string;
  quantity: number;
  unit_price: number;                      // £ per unit
  special_instructions?: string | null;
};

type OrderIn = {
  venue_id: string;
  table_number: number | null;             // nullable for takeaway
  customer_name: string;
  customer_phone?: string | null;
  items: OrderItemIn[];
  total_amount?: number;                   // optional from client; we recompute anyway
  notes?: string | null;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<OrderIn>;
    // ---- Basic validation
    if (!body?.venue_id || typeof body.venue_id !== 'string') {
      return bad('venue_id is required');
    }
    if (!body?.customer_name || !body.customer_name.trim()) {
      return bad('customer_name is required');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return bad('items must be a non-empty array');
    }

    // ---- Service role (bypass RLS for public ordering)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return bad('Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY', 500);
    }
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- Confirm venue exists
    const { data: venue, error: vErr } = await admin
      .from('venues')
      .select('venue_id')
      .eq('venue_id', body.venue_id)
      .maybeSingle();

    if (vErr) return bad(`Failed to verify venue: ${vErr.message}`, 500);
    if (!venue) return bad('Invalid venue_id', 404);

    // ---- Normalize items (qty/price) & recompute total
    const safeItems: OrderItemIn[] = body.items.map((it) => ({
      menu_item_id: it.menu_item_id ?? null,
      item_name: (it.item_name ?? '').trim() || 'Item',
      quantity: Math.max(1, Number(it.quantity ?? 1)),
      unit_price: Number.isFinite(Number(it.unit_price)) ? Number(it.unit_price) : 0,
      special_instructions: it.special_instructions ?? null,
    }));

    const computedTotal = safeItems.reduce(
      (sum, it) => sum + it.unit_price * it.quantity,
      0
    );
    // round to 2dp
    const total_amount = Math.round((computedTotal + Number.EPSILON) * 100) / 100;

    // ---- Insert order (defaults to 'pending')
    const { data: orderRow, error: orderErr } = await admin
      .from('orders')
      .insert({
        venue_id: body.venue_id,
        table_number:
          body.table_number === null || body.table_number === undefined
            ? null
            : Number.isFinite(Number(body.table_number))
            ? Number(body.table_number)
            : null,
        customer_name: body.customer_name.trim(),
        customer_phone: body.customer_phone ?? null,
        total_amount,
        notes: body.notes ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderErr || !orderRow) {
      return bad(orderErr?.message || 'Order insert failed', 500);
    }

    // ---- Insert order items
    const itemsPayload = safeItems.map((it) => ({
      order_id: orderRow.id,
      menu_item_id: it.menu_item_id,
      item_name: it.item_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      special_instructions: it.special_instructions,
    }));

    const { error: itemsErr } = await admin.from('order_items').insert(itemsPayload);
    if (itemsErr) {
      return bad(`Items insert failed: ${itemsErr.message}`, 500);
    }

    // ---- Done
    return NextResponse.json(
      { ok: true, order_id: orderRow.id },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = e?.message || 'Unexpected server error';
    return bad(msg, 500);
  }
}
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type OrderItem = {
  menu_item_id: string | null;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string | null;
};

type OrderPayload = {
  venue_id: string;
  table_number?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  items: OrderItem[];
  total_amount: number;
  notes?: string | null;
  order_status?: string;
  payment_status?: string;
  scheduled_for?: string | null;
  prep_lead_minutes?: number;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OrderPayload>;
    console.log('[ORDERS POST] raw body', body);

    if (!body.venue_id || typeof body.venue_id !== 'string') {
      return bad('venue_id is required');
    }
    if (!body.customer_name || !body.customer_name.trim()) {
      return bad('customer_name is required');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return bad('items must be a non-empty array');
    }
    if (typeof body.total_amount !== 'number' || isNaN(body.total_amount)) {
      return bad('total_amount must be a number');
    }

    const tn = body.table_number;
    const table_number = tn === null || tn === undefined ? null : Number.isFinite(tn) ? tn : null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return bad('Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY', 500);
    }
    const supabase = await createClient();

    // Verify venue exists
    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', body.venue_id)
      .maybeSingle();

    if (venueErr) return bad(`Failed to verify venue: ${venueErr.message}`, 500);
    if (!venue) return bad('Invalid venue_id');

    // Recompute total server-side for safety
    const computedTotal = body.items.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);
    const finalTotal = Math.abs(computedTotal - (body.total_amount || 0)) < 0.01 ? body.total_amount! : computedTotal;

    const safeItems = body.items.map((it) => ({
      menu_item_id: it.menu_item_id ?? null,
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0, // Use 'price' field directly
      item_name: it.item_name,
      specialInstructions: (it as any).special_instructions ?? it.specialInstructions ?? null,
    }));
    console.log('[ORDERS POST] normalized safeItems', safeItems);

    const payload: OrderPayload = {
      venue_id: body.venue_id,
      table_number,
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone ?? null,
      items: safeItems,
      total_amount: finalTotal,
      notes: body.notes ?? null,
      order_status: 'PLACED', // Set initial status as PLACED for live orders
      payment_status: 'UNPAID', // Set as PAID since order only appears after payment
    };
    console.log('[ORDERS POST] inserting order', {
      venue_id: payload.venue_id,
      table_number: payload.table_number,
      order_status: payload.order_status,
      payment_status: payload.payment_status,
      total_amount: payload.total_amount,
      itemsCount: payload.items.length,
    });

    const { data: inserted, error: insertErr } = await supabase
      .from('orders')
      .insert(payload)
      .select('id, created_at');

    if (insertErr) return bad(`Insert failed: ${insertErr.message}`, 400);
    console.log('[ORDERS POST] order inserted', inserted?.[0]);

    console.log('[ORDERS POST] inserting order_items for order_id', inserted?.[0]?.id);
    // Note: items are embedded in orders payload in this schema; if you also mirror rows in order_items elsewhere, log success after that insert
    console.log('[ORDERS POST] order_items insert success (embedded items)');
    return NextResponse.json({ ok: true, order: inserted?.[0] ?? null });
  } catch (e: any) {
    const msg = e?.message || (typeof e === 'string' ? e : 'Unknown server error');
    return bad(`Server error: ${msg}`, 500);
  }
}



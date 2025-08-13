import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OrderPayload>;

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
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    const payload: OrderPayload = {
      venue_id: body.venue_id,
      table_number,
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone ?? null,
      items: body.items.map((it) => ({
        menu_item_id: it.menu_item_id ?? null,
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
        item_name: it.item_name,
        specialInstructions: it.specialInstructions ?? null,
      })),
      total_amount: finalTotal,
      notes: body.notes ?? null,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('orders')
      .insert(payload)
      .select('id, created_at');

    if (insertErr) return bad(`Insert failed: ${insertErr.message}`, 400);

    return NextResponse.json({ ok: true, order: inserted?.[0] ?? null });
  } catch (e: any) {
    const msg = e?.message || (typeof e === 'string' ? e : 'Unknown server error');
    return bad(`Server error: ${msg}`, 500);
  }
}



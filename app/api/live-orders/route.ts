import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status');
  if (!venueId) return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  let q = supabase.from('orders')
    .select(`
      id, venue_id, table_number, customer_name, total_amount, status, notes, created_at,
      order_items:order_items ( id, item_name, price, quantity, special_instructions )
    `)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const hydrated = (data ?? []).map((o: any) => {
    const items = (o.order_items ?? []).map((it: any) => {
      const price = Number(it.price); const qty = Number(it.quantity);
      const line_total = (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
      return { ...it, price, quantity: qty, line_total };
    });
    const computed_total = items.reduce((s: number, it: any) => s + it.line_total, 0);
    const total = Number.isFinite(Number(o.total_amount)) ? Number(o.total_amount) : computed_total;
    return { ...o, items, computed_total: total };
  });

  return NextResponse.json({ ok: true, orders: hydrated });
}



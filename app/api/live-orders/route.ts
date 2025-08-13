import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status');
  console.log('[LIVE ORDERS GET] query', { venueId, status });
  if (!venueId) return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });

  // Auth and ownership check
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[LIVE ORDERS GET] user', { userId: user?.id });
  if (!user) return NextResponse.json({ ok:false, error:'Not authenticated' }, { status:401 });
  const { data: v } = await supabase
    .from('venues')
    .select('venue_id, owner_id')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();
  console.log('[LIVE ORDERS GET] venue ownership check', v);
  if (!v) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });

  // Query with status filter (open = pending+preparing)
  let q = supabase.from('orders')
    .select(`
      id, venue_id, table_number, customer_name, total_amount, status, notes, created_at,
      order_items:order_items ( id, item_name, unit_price, price, quantity, special_instructions )
    `)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(200);
  const statuses = status === 'open' ? ['pending','preparing'] : status ? [status] : ['pending','preparing'];
  if (statuses) q = q.in('status', statuses as any);
  console.log('[LIVE ORDERS GET] filter', { venueId, statuses });

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  console.log('[LIVE ORDERS GET] raw data', data);

  const hydrated = (data ?? []).map((o: any) => {
    const items = (o.order_items ?? []).map((it: any) => {
      const price = Number(it.unit_price ?? it.price);
      const qty = Number(it.quantity);
      const line_total = (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
      return { id: it.id, item_name: it.item_name, price, quantity: qty, special_instructions: it.special_instructions, line_total };
    });
    const computed_total = items.reduce((s: number, it: any) => s + it.line_total, 0);
    const total = Number.isFinite(Number(o.total_amount)) ? Number(o.total_amount) : computed_total;
    return { ...o, items, computed_total: total };
  });
  console.log('[LIVE ORDERS GET] hydrated', hydrated);

  return NextResponse.json({ ok: true, orders: hydrated });
}
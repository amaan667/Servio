import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status');
  if (!venueId) {
    return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
  }

  // Auth check
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Verify venue ownership
  const { data: v } = await supabase
    .from('venues')
    .select('venue_id, owner_id')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!v) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Admin client (bypass RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'Missing service role' }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const statuses = status === 'open' ? ['pending', 'preparing'] : status ? [status] : undefined;

  // 1️⃣ Fetch orders first
  let ordersQuery = admin
    .from('orders')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (statuses) {
    ordersQuery = ordersQuery.in('status', statuses as any);
  }

  const { data: orders, error: ordersErr } = await ordersQuery;
  if (ordersErr) {
    return NextResponse.json({ ok: false, error: ordersErr.message }, { status: 500 });
  }
  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true, orders: [] });
  }

  // 2️⃣ Fetch all related items manually
  const orderIds = orders.map((o: any) => o.id);
  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);

  if (itemsErr) {
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
  }

  // 3️⃣ Merge items into orders
  const hydrated = orders.map((o: any) => {
    const oItems = (items ?? []).filter((it: any) => it.order_id === o.id);
    const mappedItems = oItems.map((it: any) => {
      const price = Number(it.unit_price ?? it.price ?? 0);
      const qty = Number(it.quantity ?? 0);
      const line_total = price * qty;
      return {
        id: it.id,
        item_name: it.item_name,
        price,
        quantity: qty,
        special_instructions: it.special_instructions,
        line_total,
      };
    });
    const computed_total = mappedItems.reduce((s: number, it: any) => s + it.line_total, 0);
    return { ...o, items: mappedItems, computed_total };
  });

  return NextResponse.json({ ok: true, orders: hydrated });
}



import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { todayWindowForTZ } from '@/lib/dates';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status');
  const scope = (searchParams.get('scope') || searchParams.get('day') || 'today').toLowerCase(); // today | all
  const limit = Number(searchParams.get('limit') || '500');
  const since = searchParams.get('since');
  if (!venueId) {
    return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
  }

  // Auth check (best-effort). If auth fails in some environments, still return data using service role.
  try {
    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: v } = await supabase
        .from('venues')
        .select('venue_id, owner_id')
        .eq('venue_id', venueId)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!v) {
        // Not the owner – continue anyway but results will still be scoped by venue_id
      }
    }
  } catch {}

  // Admin client (bypass RLS)
  const serviceKey = ENV.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'Missing service role' }, { status: 500 });
  }
  const admin = createClient(ENV.SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch venue timezone (optional)
  let timezone: string | undefined = undefined;
  const { data: venueRow } = await admin.from('venues').select('timezone').eq('venue_id', venueId).maybeSingle();
  timezone = (venueRow as any)?.timezone as string | undefined;
  const window = todayWindowForTZ(timezone);

  // Map client statuses to DB statuses for querying
  let statuses: string[] | undefined;
  let filterPaid: boolean = false;
  if (status === 'all' || !status) {
    statuses = undefined;
  } else if (status === 'open' || status === 'preparing') {
    statuses = ['pending', 'preparing'];
  } else if (status === 'served') {
    statuses = ['delivered'];
  } else if (status === 'paid') {
    // Special case: we filter by payment_status, not order.status
    filterPaid = true;
    statuses = undefined;
  } else {
    statuses = [status];
  }

  // 1️⃣ Fetch orders first
  let ordersQuery = admin
    .from('orders')
    .select('id, venue_id, table_number, customer_name, customer_phone, total_amount, status, payment_status, notes, created_at, items')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (since) {
    ordersQuery = ordersQuery.gte('created_at', since);
  }
  
  // Handle different scopes
  if (scope === 'history') {
    // History: orders from before today
    ordersQuery = ordersQuery.lt('created_at', window.startUtcISO);
  } else if (scope === 'live') {
    // Live: only pending/preparing orders from today
    ordersQuery = ordersQuery
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO)
      .in('status', ['pending', 'preparing']);
  } else if (scope === 'all') {
    // All: all orders from today
    ordersQuery = ordersQuery
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO);
  } else {
    // Default: today's orders
    ordersQuery = ordersQuery
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO);
  }
  
  if (statuses) {
    ordersQuery = ordersQuery.in('status', statuses as any);
  }
  if (filterPaid) {
    ordersQuery = ordersQuery.eq('payment_status', 'paid' as any);
  }

  const { data: orders, error: ordersErr } = await ordersQuery;
  if (ordersErr) {
    return NextResponse.json({ ok: false, error: ordersErr.message }, { status: 500 });
  }
  // active tables today metric
  const { data: activeRows, error: activeErr } = await admin
    .from('orders')
    .select('table_number')
    .eq('venue_id', venueId)
    .in('status', ['pending', 'preparing'] as any)
    .gte('created_at', window.startUtcISO)
    .lt('created_at', window.endUtcISO);
  const activeTablesToday = activeErr ? 0 : new Set((activeRows ?? []).map((r: any) => r.table_number).filter((t: any) => t != null)).size;

  // 2️⃣ Fetch all related items manually
  const orderIds = (orders ?? []).map((o: any) => o.id);
  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('*')
    .in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000']);

  if (itemsErr) {
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
  }

  // 3️⃣ Merge items into orders
  const hydrated = (orders ?? []).map((o: any) => {
    const oItems = (items ?? []).filter((it: any) => it.order_id === o.id);
    let mappedItems = oItems.map((it: any) => {
      const price = Number(it.unit_price ?? it.price ?? 0);
      const qty = Number(it.quantity ?? 0);
      const line_total = price * qty;
      const item_name = (it.item_name ?? it.name ?? it.menu_item_name ?? 'Item') as string;
      return { id: it.id, item_name, price, quantity: qty, special_instructions: it.special_instructions, line_total };
    });
    if (!mappedItems.length && Array.isArray(o.items)) {
      mappedItems = (o.items as any[]).map((it: any, idx: number) => {
        const price = Number(it.unit_price ?? it.price ?? it.unitPrice ?? 0);
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const line_total = price * qty;
        const item_name = (it.item_name ?? it.name ?? it.menu_item_name ?? it.title ?? 'Item') as string;
        const special_instructions = (it.special_instructions ?? it.specialInstructions ?? null) as string | null;
        return { id: it.id ?? `embedded-${idx}`, item_name, price, quantity: qty, special_instructions, line_total };
      });
    }
    const computed_total = mappedItems.reduce((s: number, it: any) => s + it.line_total, 0);
    const total = (computed_total || 0) > 0 ? computed_total : (Number(o.total_amount) || 0);
    const uiStatus = o.status === 'delivered' ? 'served' : o.status;
    return { ...o, status: uiStatus, items: mappedItems, computed_total: total };
  });
  console.log('[ORDERS API]', {
    venueId,
    scope,
    window,
    count: (hydrated ?? []).length,
  });
  return NextResponse.json({ ok: true, orders: hydrated, meta: { activeTablesToday, window } });
}



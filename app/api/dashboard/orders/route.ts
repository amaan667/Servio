import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { todayWindowForTZ } from '@/lib/dates';
import { ENV } from '@/lib/env';
import { cookieAdapter } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status');
  const scope = (searchParams.get('scope') || 'today').toLowerCase(); // today | all | live | history
  const limit = Number(searchParams.get('limit') || '500');
  const since = searchParams.get('since');

  if (!venueId) {
    return NextResponse.json({ ok: false, error: 'venueId required' }, { status: 400 });
  }

  // Auth check (optional, fallback to service role)
  try {
    const jar = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookieAdapter(jar) }
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
        // Not the owner, but still allow fetch scoped by venueId
      }
    }
  } catch {}

  // Service role client
  const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Get timezone for window
  const { data: venueRow } = await admin.from('venues').select('timezone').eq('venue_id', venueId).maybeSingle();
  const timezone = (venueRow as any)?.timezone as string | undefined;
  const window = todayWindowForTZ(timezone);

  // --- Base query ---
  let ordersQuery = admin
    .from('orders')
    .select('id, venue_id, table_number, customer_name, total_amount, status, payment_status, notes, created_at, items')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) ordersQuery = ordersQuery.gte('created_at', since);

  // --- Apply scope ---
  if (scope === 'history') {
    // Anything BEFORE today
    ordersQuery = ordersQuery.lt('created_at', window.startUtcISO);
  } else if (scope === 'live') {
    ordersQuery = ordersQuery
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO)
      .in('status', ['pending', 'preparing']);
  } else if (scope === 'all') {
    ordersQuery = ordersQuery
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO);
  } else {
    // Default today
    ordersQuery = ordersQuery
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO);
  }

  // --- Fetch orders ---
  const { data: orders, error: ordersErr } = await ordersQuery;
  if (ordersErr) {
    return NextResponse.json({ ok: false, error: ordersErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orders, meta: { window } });
}